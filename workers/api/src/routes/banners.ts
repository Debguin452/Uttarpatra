import { Hono } from "hono";
import type { AppEnv } from "../index";

const app = new Hono<AppEnv>();

// batch_id is resolved here for lecture, material and test banners too, so the
// app knows which batch page to open without asking again. Rows saved before
// banners had targets fall back to their old batch_id / link_url.
app.get("/", async (c) => {
  const rows = await c.env.DB
    .prepare(
      `SELECT bn.id, bn.image_url, bn.title_bn, bn.title_en, bn.link_url,
              COALESCE(bn.target_type, CASE WHEN bn.batch_id IS NOT NULL THEN 'batch' WHEN bn.link_url IS NOT NULL THEN 'link' END) AS target_type,
              COALESCE(bn.target_id, bn.batch_id) AS target_id,
              COALESCE(l.batch_id, n.batch_id, t.batch_id, bn.batch_id) AS batch_id
       FROM banners bn
       LEFT JOIN lectures l ON bn.target_type = 'lecture' AND l.id = bn.target_id
       LEFT JOIN notes n ON bn.target_type = 'material' AND n.id = bn.target_id
       LEFT JOIN tests t ON bn.target_type = 'test' AND t.id = bn.target_id
       WHERE bn.status = 'active'
       ORDER BY bn.order_index LIMIT 10`,
    )
    .all();
  return c.json(rows.results);
});

export default app;
