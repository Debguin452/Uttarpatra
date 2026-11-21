import { Hono } from "hono";
import { ChapterUpsert } from "@coaching-app/shared/schema";
import type { AppEnv } from "../../index";

const app = new Hono<AppEnv>();

app.get("/", async (c) => {
  const batchId = c.req.query("batchId");
  const rows = await c.env.DB
    .prepare(
      batchId
        ? `SELECT ch.id, ch.batch_id, b.title_en AS batch_title_en, ch.subject_id, s.name_en AS subject_name_en,
                  ch.title_bn, ch.title_en, ch.order_index, ch.created_at
           FROM chapters ch JOIN batches b ON b.id = ch.batch_id JOIN subjects s ON s.id = ch.subject_id
           WHERE ch.batch_id = ? ORDER BY ch.order_index, ch.created_at`
        : `SELECT ch.id, ch.batch_id, b.title_en AS batch_title_en, ch.subject_id, s.name_en AS subject_name_en,
                  ch.title_bn, ch.title_en, ch.order_index, ch.created_at
           FROM chapters ch JOIN batches b ON b.id = ch.batch_id JOIN subjects s ON s.id = ch.subject_id
           ORDER BY ch.created_at DESC LIMIT 200`,
    )
    .bind(...(batchId ? [batchId] : []))
    .all();
  return c.json(rows.results);
});

app.post("/", async (c) => {
  const parsed = ChapterUpsert.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_input", issues: parsed.error.flatten() }, 400);
  const { batchId, subjectId, titleBn, titleEn, orderIndex } = parsed.data;

  const id = crypto.randomUUID();
  await c.env.DB
    .prepare(`INSERT INTO chapters (id, batch_id, subject_id, title_bn, title_en, order_index) VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(id, batchId, subjectId, titleBn, titleEn, orderIndex)
    .run();

  return c.json({ ok: true, id });
});

app.put("/:id", async (c) => {
  const parsed = ChapterUpsert.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_input", issues: parsed.error.flatten() }, 400);
  const { batchId, subjectId, titleBn, titleEn, orderIndex } = parsed.data;

  const result = await c.env.DB
    .prepare(`UPDATE chapters SET batch_id = ?, subject_id = ?, title_bn = ?, title_en = ?, order_index = ? WHERE id = ?`)
    .bind(batchId, subjectId, titleBn, titleEn, orderIndex, c.req.param("id"))
    .run();
  if (result.meta.changes === 0) return c.json({ error: "not_found" }, 404);
  return c.json({ ok: true });
});

app.delete("/:id", async (c) => {
  const id = c.req.param("id");
  // Detach anything grouped under this chapter rather than deleting it —
  // losing the grouping is recoverable, losing the content isn't.
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE lectures SET chapter_id = NULL WHERE chapter_id = ?").bind(id),
    c.env.DB.prepare("UPDATE notes SET chapter_id = NULL WHERE chapter_id = ?").bind(id),
  ]);
  const result = await c.env.DB.prepare("DELETE FROM chapters WHERE id = ?").bind(id).run();
  if (result.meta.changes === 0) return c.json({ error: "not_found" }, 404);
  return c.json({ ok: true });
});

export default app;
