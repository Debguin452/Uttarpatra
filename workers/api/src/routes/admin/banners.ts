import { Hono } from "hono";
import { BannerUpsert } from "@coaching-app/shared/schema";
import type { AppEnv } from "../../index";

// One place that turns the form into what is stored. batch_id and link_url
// stay filled for batch and link banners so older readers keep working.
function target(b: BannerUpsert) {
  const type = b.targetType ?? (b.batchId ? "batch" : b.linkUrl ? "link" : null);
  const id = type && type !== "link" ? (b.targetId ?? b.batchId ?? null) : null;
  return { type, id, batchId: type === "batch" ? id : null, linkUrl: type === "link" ? (b.linkUrl ?? null) : null };
}

const app = new Hono<AppEnv>();

app.get("/", async (c) => {
  const rows = await c.env.DB
    .prepare("SELECT id, image_url, title_bn, title_en, batch_id, link_url, target_type, target_id, order_index, status, created_at FROM banners ORDER BY order_index, created_at DESC")
    .all();
  return c.json(rows.results);
});

app.post("/", async (c) => {
  const parsed = BannerUpsert.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_input", issues: parsed.error.flatten() }, 400);
  const { imageUrl, titleBn, titleEn, orderIndex, status } = parsed.data;
  const to = target(parsed.data);

  const id = crypto.randomUUID();
  await c.env.DB
    .prepare(
      `INSERT INTO banners (id, image_url, title_bn, title_en, batch_id, link_url, target_type, target_id, order_index, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, imageUrl, titleBn, titleEn, to.batchId, to.linkUrl, to.type, to.id, orderIndex, status)
    .run();

  return c.json({ ok: true, id });
});

app.put("/:id", async (c) => {
  const parsed = BannerUpsert.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_input", issues: parsed.error.flatten() }, 400);
  const { imageUrl, titleBn, titleEn, orderIndex, status } = parsed.data;
  const to = target(parsed.data);

  const result = await c.env.DB
    .prepare(
      `UPDATE banners SET image_url = ?, title_bn = ?, title_en = ?, batch_id = ?, link_url = ?, target_type = ?, target_id = ?,
              order_index = ?, status = ?
       WHERE id = ?`,
    )
    .bind(imageUrl, titleBn, titleEn, to.batchId, to.linkUrl, to.type, to.id, orderIndex, status, c.req.param("id"))
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
