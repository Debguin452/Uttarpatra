import { Hono } from "hono";
import type { AppEnv } from "../index";

const app = new Hono<AppEnv>();

app.get("/", async (c) => {
  const rows = await c.env.DB
    .prepare(
      `SELECT id, title_bn, title_en, body_bn, body_en, pinned, created_at FROM notices
       WHERE batch_id IS NULL
          OR batch_id IN (SELECT batch_id FROM enrollments WHERE uid = ? AND (expires_at IS NULL OR expires_at > unixepoch()))
       ORDER BY pinned DESC, created_at DESC LIMIT 20`,
    )
    .bind(c.get("uid"))
    .all();
  return c.json(rows.results);
});

export default app;
