import { Hono } from "hono";
import type { AppEnv } from "../index";

const app = new Hono<AppEnv>();

app.get("/", async (c) => {
  const uid = c.get("uid");
  const rows = await c.env.DB
    .prepare(
      `SELECT t.id, t.batch_id, t.title_bn, t.title_en, t.kind, t.duration_sec, t.total_marks,
              t.negative_mark, t.opens_at, t.closes_at, t.status,
              a.score, a.submitted_at
       FROM tests t
       LEFT JOIN attempts a ON a.test_id = t.id AND a.uid = ?1
       WHERE t.status IN ('live', 'closed')
         AND (
           t.batch_id IS NULL
           OR EXISTS (SELECT 1 FROM enrollments e WHERE e.uid = ?1 AND e.batch_id = t.batch_id AND (e.expires_at IS NULL OR e.expires_at > unixepoch()))
           OR EXISTS (SELECT 1 FROM batches b WHERE b.id = t.batch_id AND b.kind = 'free')
         )
       ORDER BY t.created_at DESC LIMIT 100`,
    )
    .bind(uid)
    .all();
  return c.json(rows.results);
});

export default app;
