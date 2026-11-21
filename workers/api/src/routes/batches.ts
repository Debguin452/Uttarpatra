import { Hono } from "hono";
import type { AppEnv, Env } from "../index";
import { canOpenBatch } from "../lib/batchAccess";

const publicRoutes = new Hono<{ Bindings: Env }>();

publicRoutes.get("/", async (c) => {
  const rows = await c.env.DB
    .prepare(
      "SELECT id, title_bn, title_en, track, kind, price_paise, summary_bn, summary_en, preview_video_id, banner_url FROM batches WHERE status = 'published' ORDER BY created_at DESC",
    )
    .all();
  return c.json(rows.results);
});

const authedRoutes = new Hono<AppEnv>();

authedRoutes.get("/mine", async (c) => {
  const rows = await c.env.DB
    .prepare(
      `SELECT b.id, b.title_bn, b.title_en, b.track, b.kind, b.price_paise, b.summary_bn, b.summary_en,
              b.preview_video_id, b.banner_url, b.status, e.expires_at
       FROM enrollments e JOIN batches b ON b.id = e.batch_id
       WHERE e.uid = ? AND b.status IN ('published', 'archived')
         AND (e.expires_at IS NULL OR e.expires_at > unixepoch())
       ORDER BY b.created_at DESC`,
    )
    .bind(c.get("uid"))
    .all();
  return c.json(rows.results);
});

// "Today's live classes": live lectures starting within the next 24h (plus a
// 2h grace window for ones already under way) across batches the student is
// enrolled in, or any free batch.
authedRoutes.get("/live-today", async (c) => {
  const uid = c.get("uid");
  const now = Math.floor(Date.now() / 1000);
  const rows = await c.env.DB
    .prepare(
      `SELECT l.id, l.batch_id, b.title_bn AS batch_title_bn, b.title_en AS batch_title_en,
              l.title_bn, l.title_en, l.youtube_id, l.live_at
       FROM lectures l JOIN batches b ON b.id = l.batch_id
       WHERE l.is_live = 1 AND l.live_at IS NOT NULL
         AND l.live_at BETWEEN ?1 AND ?2
         AND b.status = 'published'
         AND (
           b.kind = 'free'
           OR EXISTS (SELECT 1 FROM enrollments e WHERE e.uid = ?3 AND e.batch_id = b.id AND (e.expires_at IS NULL OR e.expires_at > unixepoch()))
         )
       ORDER BY l.live_at LIMIT 20`,
    )
    .bind(now - 7200, now + 86400, uid)
    .all();
  return c.json(rows.results);
});

// Teachers assigned to a batch, as students see them: name, photo, the subject
// they take and the profile they wrote when they applied. Phone numbers and
// ids are never sent. Only approved teachers show their qualification and bio.
authedRoutes.get("/:id/teachers", async (c) => {
  const batchId = c.req.param("id");
  const batch = await c.env.DB
    .prepare("SELECT 1 FROM batches WHERE id = ? AND status IN ('published', 'archived')")
    .bind(batchId)
    .first();
  if (!batch) return c.json({ error: "not_found" }, 404);

  const rows = await c.env.DB
    .prepare(
      `SELECT u.name, u.photo_url, s.name_bn AS subject_bn, s.name_en AS subject_en,
              ta.qualification, ta.experience_years, ta.bio
       FROM batch_teachers bt
       JOIN users u ON u.uid = bt.teacher_uid AND u.status = 'active'
       LEFT JOIN subjects s ON s.id = bt.subject
       LEFT JOIN teacher_applications ta ON ta.uid = bt.teacher_uid AND ta.status = 'approved'
       WHERE bt.batch_id = ?
       ORDER BY u.name`,
    )
    .bind(batchId)
    .all();
  return c.json(rows.results);
});

authedRoutes.get("/:id/content", async (c) => {
  const batchId = c.req.param("id");
  const uid = c.get("uid");

  const access = await canOpenBatch(c.env.DB, uid, batchId);
  if (access === "not_found") return c.json({ error: "not_found" }, 404);
  if (access === "not_enrolled") return c.json({ error: "not_enrolled" }, 403);

  const cache = caches.default;
  // v2: payload now also includes chapters and chapter_id on lectures/notes.
  const cacheKey = new Request(`https://cache.internal/batch-content-v2/${batchId}`);
  const hit = await cache.match(cacheKey);
  if (hit) return c.json(await hit.json());

  // Drafts never leave the server. A lecture scheduled for later is listed (so
  // students can see what is coming) but its video id is withheld until then.
  const [lectures, subjects, chapters, notes] = await Promise.all([
    c.env.DB
      .prepare(
        `SELECT id, subject_id, chapter_id, chapter, title_bn, title_en,
                CASE WHEN release_at IS NOT NULL AND release_at > unixepoch() THEN NULL ELSE youtube_id END AS youtube_id,
                duration_sec, order_index, is_live, live_at, release_at,
                (release_at IS NOT NULL AND release_at > unixepoch()) AS locked
         FROM lectures WHERE batch_id = ? AND status = 'published' ORDER BY order_index, created_at`,
      )
      .bind(batchId)
      .all(),
    c.env.DB
      .prepare(
        `SELECT id, name_bn, name_en, sort_order FROM subjects
         WHERE id IN (SELECT subject_id FROM lectures WHERE batch_id = ? AND status = 'published' AND subject_id IS NOT NULL)
         ORDER BY sort_order, name_en`,
      )
      .bind(batchId)
      .all(),
    c.env.DB
      .prepare(
        `SELECT id, subject_id, title_bn, title_en, order_index FROM chapters WHERE batch_id = ? ORDER BY order_index`,
      )
      .bind(batchId)
      .all(),
    c.env.DB
      .prepare(
        "SELECT id, lecture_id, chapter_id, title_bn, title_en, drive_file_id, kind FROM notes WHERE batch_id = ? ORDER BY created_at DESC",
      )
      .bind(batchId)
      .all(),
  ]);

  const body = { lectures: lectures.results, subjects: subjects.results, chapters: chapters.results, notes: notes.results };

  c.executionCtx.waitUntil(
    cache.put(
      cacheKey,
      new Response(JSON.stringify(body), {
        headers: { "content-type": "application/json", "cache-control": "public, max-age=60" },
      }),
    ),
  );
  return c.json(body);
});

export default { public: publicRoutes, authed: authedRoutes };
