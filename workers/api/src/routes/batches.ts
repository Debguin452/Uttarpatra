import { Hono } from "hono";
import type { AppEnv, Env } from "../index";

const publicRoutes = new Hono<{ Bindings: Env }>();

publicRoutes.get("/", async (c) => {
  const rows = await c.env.DB
    .prepare(
      "SELECT id, title_bn, title_en, track, kind, price_paise, summary_bn, summary_en, preview_video_id FROM batches WHERE status = 'published' ORDER BY created_at DESC",
    )
    .all();
  return c.json(rows.results);
});

const authedRoutes = new Hono<AppEnv>();

authedRoutes.get("/mine", async (c) => {
  const rows = await c.env.DB
    .prepare(
      `SELECT b.id, b.title_bn, b.title_en, b.track, b.kind, b.price_paise, b.summary_bn, b.summary_en,
              b.preview_video_id, b.status, e.expires_at
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

authedRoutes.get("/:id/content", async (c) => {
  const batchId = c.req.param("id");
  const uid = c.get("uid");

  const batch = await c.env.DB
    .prepare("SELECT kind, status FROM batches WHERE id = ? AND status IN ('published', 'archived')")
    .bind(batchId)
    .first<{ kind: string; status: string }>();
  if (!batch) return c.json({ error: "not_found" }, 404);

  if (batch.kind === "paid" || batch.status === "archived") {
    const enrolled = await c.env.DB
      .prepare(
        "SELECT 1 FROM enrollments WHERE uid = ? AND batch_id = ? AND (expires_at IS NULL OR expires_at > unixepoch())",
      )
      .bind(uid, batchId)
      .first();
    if (!enrolled) {
      return batch.status === "archived" ? c.json({ error: "not_found" }, 404) : c.json({ error: "not_enrolled" }, 403);
    }
  }

  const cache = caches.default;
  const cacheKey = new Request(`https://cache.internal/batch-content/${batchId}`);
  const hit = await cache.match(cacheKey);
  if (hit) return c.json(await hit.json());

  const [lectures, notes] = await Promise.all([
    c.env.DB
      .prepare(
        "SELECT id, chapter, title_bn, title_en, youtube_id, duration_sec, is_live, live_at FROM lectures WHERE batch_id = ? ORDER BY order_index",
      )
      .bind(batchId)
      .all(),
    c.env.DB
      .prepare(
        "SELECT id, lecture_id, title_bn, title_en, drive_file_id, kind FROM notes WHERE batch_id = ? ORDER BY created_at DESC",
      )
      .bind(batchId)
      .all(),
  ]);

  const body = { lectures: lectures.results, notes: notes.results };

  c.executionCtx.waitUntil(
    cache.put(
      cacheKey,
      new Response(JSON.stringify(body), {
        headers: { "content-type": "application/json", "cache-control": "public, max-age=120" },
      }),
    ),
  );
  return c.json(body);
});

export default { public: publicRoutes, authed: authedRoutes };
