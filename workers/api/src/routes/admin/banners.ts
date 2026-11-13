import { Hono } from "hono";
import { BannerUpsert } from "@coaching-app/shared/schema";
import type { AppEnv } from "../../index";

const app = new Hono<AppEnv>();

app.get("/", async (c) => {
  const rows = await c.env.DB
    .prepare("SELECT id, image_url, title_bn, title_en, batch_id, link_url, order_index, status, created_at FROM banners ORDER BY order_index, created_at DESC")
    .all();
  return c.json(rows.results);
});

app.post("/", async (c) => {
  const parsed = BannerUpsert.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_input", issues: parsed.error.flatten() }, 400);
  const { imageUrl, titleBn, titleEn, batchId, linkUrl, orderIndex, status } = parsed.data;

  const id = crypto.randomUUID();
  await c.env.DB
    .prepare(
      `INSERT INTO banners (id, image_url, title_bn, title_en, batch_id, link_url, order_index, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, imageUrl, titleBn, titleEn, batchId ?? null, linkUrl ?? null, orderIndex, status)
    .run();

  return c.json({ ok: true, id });
});

app.put("/:id", async (c) => {
  const parsed = BannerUpsert.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_input", issues: parsed.error.flatten() }, 400);
  const { imageUrl, titleBn, titleEn, batchId, linkUrl, orderIndex, status } = parsed.data;

  const result = await c.env.DB
    .prepare(
      `UPDATE banners SET image_url = ?, title_bn = ?, title_en = ?, batch_id = ?, link_url = ?, order_index = ?, status = ?
       WHERE id = ?`,
    )
    .bind(imageUrl, titleBn, titleEn, batchId ?? null, linkUrl ?? null, orderIndex, status, c.req.param("id"))
    .run();
  if (result.meta.changes === 0) return c.json({ error: "not_found" }, 404);
  return c.json({ ok: true });
});

app.delete("/:id", async (c) => {
  const result = await c.env.DB.prepare("DELETE FROM banners WHERE id = ?").bind(c.req.param("id")).run();
  if (result.meta.changes === 0) return c.json({ error: "not_found" }, 404);
  return c.json({ ok: true });
});

export default app;
