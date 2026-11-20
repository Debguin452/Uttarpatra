import { Hono } from "hono";
import { LectureProgressUpdate } from "@coaching-app/shared/schema";
import { shouldComplete } from "@coaching-app/shared/learning";
import type { AppEnv } from "../index";
import { canOpenBatch } from "../lib/batchAccess";

const app = new Hono<AppEnv>();

// One row per batch the student is learning in, with how far along they are.
app.get("/summary", async (c) => {
  const uid = c.get("uid");
  const rows = await c.env.DB
    .prepare(
      `SELECT b.id AS batch_id, b.title_bn, b.title_en, b.track, b.kind, b.banner_url,
              (SELECT COUNT(*) FROM lectures l WHERE l.batch_id = b.id AND l.status = 'published'
                 AND (l.release_at IS NULL OR l.release_at <= unixepoch())) AS total,
              (SELECT COUNT(*) FROM lecture_progress p JOIN lectures l ON l.id = p.lecture_id
                 WHERE p.uid = ?1 AND p.batch_id = b.id AND p.completed_at IS NOT NULL AND l.status = 'published') AS done,
              (SELECT MAX(p.updated_at) FROM lecture_progress p WHERE p.uid = ?1 AND p.batch_id = b.id) AS last_at
       FROM batches b
       WHERE b.status IN ('published', 'archived')
         AND (b.id IN (SELECT batch_id FROM enrollments e WHERE e.uid = ?1 AND (e.expires_at IS NULL OR e.expires_at > unixepoch()))
              OR (b.kind = 'free' AND b.status = 'published'
                  AND b.id IN (SELECT batch_id FROM lecture_progress WHERE uid = ?1)))
       ORDER BY last_at IS NULL, last_at DESC, b.created_at DESC`,
    )
    .bind(uid)
    .all();
  return c.json(rows.results);
});

app.get("/:batchId/progress", async (c) => {
  const batchId = c.req.param("batchId");
  const access = await canOpenBatch(c.env.DB, c.get("uid"), batchId);
  if (access === "not_found") return c.json({ error: "not_found" }, 404);
  if (access === "not_enrolled") return c.json({ error: "not_enrolled" }, 403);

  const rows = await c.env.DB
    .prepare(
      `SELECT lecture_id, position_sec, duration_sec, completed_at IS NOT NULL AS completed, updated_at
       FROM lecture_progress WHERE uid = ? AND batch_id = ?`,
    )
    .bind(c.get("uid"), batchId)
    .all();
  return c.json(rows.results);
});

// Saved every few seconds while a lecture plays, and once more when it
// pauses, ends or is left. Completion is sticky: watching again never undoes it.
app.put("/lectures/:id/progress", async (c) => {
  const uid = c.get("uid");
  const parsed = LectureProgressUpdate.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_input" }, 400);

  const lecture = await c.env.DB
    .prepare(
      `SELECT batch_id, duration_sec FROM lectures
       WHERE id = ? AND status = 'published' AND (release_at IS NULL OR release_at <= unixepoch())`,
    )
    .bind(c.req.param("id"))
    .first<{ batch_id: string; duration_sec: number | null }>();
  if (!lecture) return c.json({ error: "not_found" }, 404);

  const access = await canOpenBatch(c.env.DB, uid, lecture.batch_id);
  if (access === "not_found") return c.json({ error: "not_found" }, 404);
  if (access === "not_enrolled") return c.json({ error: "not_enrolled" }, 403);

  const { positionSec, durationSec, completed } = parsed.data;
  const duration = durationSec ?? lecture.duration_sec ?? null;
  const done = completed === true || shouldComplete(positionSec, duration);

  await c.env.DB
    .prepare(
      `INSERT INTO lecture_progress (uid, lecture_id, batch_id, position_sec, duration_sec, completed_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, CASE WHEN ?6 THEN unixepoch() END, unixepoch())
       ON CONFLICT(uid, lecture_id) DO UPDATE SET
         position_sec = excluded.position_sec,
         duration_sec = COALESCE(excluded.duration_sec, lecture_progress.duration_sec),
         completed_at = COALESCE(lecture_progress.completed_at, excluded.completed_at),
         updated_at = unixepoch()`,
    )
    .bind(uid, c.req.param("id"), lecture.batch_id, positionSec, duration, done ? 1 : 0)
    .run();
  return c.json({ ok: true, completed: done });
});

export default app;
