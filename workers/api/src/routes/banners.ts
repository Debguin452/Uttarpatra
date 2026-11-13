import { Hono } from "hono";
import type { AppEnv } from "../index";

const app = new Hono<AppEnv>();

app.get("/", async (c) => {
  const rows = await c.env.DB
    .prepare(
      "SELECT id, image_url, title_bn, title_en, batch_id, link_url FROM banners WHERE status = 'active' ORDER BY order_index LIMIT 10",
    )
    .all();
  return c.json(rows.results);
});

export default app;
