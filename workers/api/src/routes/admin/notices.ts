import { Hono } from "hono";
import { ulid } from "ulidx";
import { NoticeUpsert } from "@coaching-app/shared/schema";
import type { AppEnv } from "../../index";

const app = new Hono<AppEnv>();

async function batchMissing(db: D1Database, batchId: string | null | undefined): Promise<boolean> {
  if (!batchId) return false;
  const row = await db.prepare("SELECT 1 FROM batches WHERE id = ?").bind(batchId).first();
  return !row;
}

app.get("/", async (c) => {
  const rows = await c.env.DB
    .prepare(
      `SELECT n.id, n.title_bn, n.title_en, n.body_bn, n.body_en, n.batch_id, b.title_en AS batch_title_en,
              n.pinned, n.created_at
       FROM notices n LEFT JOIN batches b ON b.id = n.batch_id
       ORDER BY n.pinned DESC, n.created_at DESC LIMIT 100`,
    )
    .all();
  return c.json(rows.results);
});

app.post("/", async (c) => {
  const parsed = NoticeUpsert.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_input", issues: parsed.error.flatten() }, 400);
  const n = parsed.data;
  if (await batchMissing(c.env.DB, n.batchId)) return c.json({ error: "batch_not_found" }, 400);

  const id = ulid();
  await c.env.DB
    .prepare(
      `INSERT INTO notices (id, title_bn, title_en, body_bn, body_en, batch_id, pinned)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, n.titleBn, n.titleEn, n.bodyBn ?? null, n.bodyEn ?? null, n.batchId ?? null, n.pinned ? 1 : 0)
    .run();
  return c.json({ id }, 201);
});

app.put("/:id", async (c) => {
  const parsed = NoticeUpsert.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_input", issues: parsed.error.flatten() }, 400);
  const n = parsed.data;
  if (await batchMissing(c.env.DB, n.batchId)) return c.json({ error: "batch_not_found" }, 400);

  const claim = await c.env.DB
    .prepare(
      `UPDATE notices SET title_bn = ?, title_en = ?, body_bn = ?, body_en = ?, batch_id = ?, pinned = ?
       WHERE id = ?`,
    )
    .bind(n.titleBn, n.titleEn, n.bodyBn ?? null, n.bodyEn ?? null, n.batchId ?? null, n.pinned ? 1 : 0, c.req.param("id"))
    .run();
  if (claim.meta.changes === 0) return c.json({ error: "not_found" }, 404);
  return c.json({ ok: true });
});

app.delete("/:id", async (c) => {
  const claim = await c.env.DB.prepare("DELETE FROM notices WHERE id = ?").bind(c.req.param("id")).run();
  if (claim.meta.changes === 0) return c.json({ error: "not_found" }, 404);
  return c.json({ ok: true });
});

export default app;
