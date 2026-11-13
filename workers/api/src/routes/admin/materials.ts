import { Hono } from "hono";
import { NoteUpsert } from "@coaching-app/shared/schema";
import type { AppEnv } from "../../index";

const app = new Hono<AppEnv>();

app.get("/", async (c) => {
  const batchId = c.req.query("batchId");
  const rows = await c.env.DB
    .prepare(
      batchId
        ? `SELECT n.id, n.batch_id, b.title_en AS batch_title_en, n.lecture_id, n.title_bn, n.title_en,
                  n.drive_file_id, n.kind, n.is_free, n.created_at
           FROM notes n LEFT JOIN batches b ON b.id = n.batch_id
           WHERE n.batch_id = ? ORDER BY n.created_at DESC`
        : `SELECT n.id, n.batch_id, b.title_en AS batch_title_en, n.lecture_id, n.title_bn, n.title_en,
                  n.drive_file_id, n.kind, n.is_free, n.created_at
           FROM notes n LEFT JOIN batches b ON b.id = n.batch_id
           ORDER BY n.created_at DESC LIMIT 200`,
    )
    .bind(...(batchId ? [batchId] : []))
    .all();
  return c.json(rows.results);
});

app.post("/", async (c) => {
  const parsed = NoteUpsert.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_input", issues: parsed.error.flatten() }, 400);
  const { batchId, lectureId, titleBn, titleEn, driveFileId, kind, isFree } = parsed.data;

  const id = crypto.randomUUID();
  await c.env.DB
    .prepare(
      `INSERT INTO notes (id, batch_id, lecture_id, title_bn, title_en, drive_file_id, kind, is_free)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, batchId ?? null, lectureId ?? null, titleBn, titleEn, driveFileId, kind, isFree ? 1 : 0)
    .run();

  return c.json({ ok: true, id });
});

app.put("/:id", async (c) => {
  const parsed = NoteUpsert.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_input", issues: parsed.error.flatten() }, 400);
  const { batchId, lectureId, titleBn, titleEn, driveFileId, kind, isFree } = parsed.data;

  const result = await c.env.DB
    .prepare(
      `UPDATE notes SET batch_id = ?, lecture_id = ?, title_bn = ?, title_en = ?, drive_file_id = ?, kind = ?, is_free = ?
       WHERE id = ?`,
    )
    .bind(batchId ?? null, lectureId ?? null, titleBn, titleEn, driveFileId, kind, isFree ? 1 : 0, c.req.param("id"))
    .run();
  if (result.meta.changes === 0) return c.json({ error: "not_found" }, 404);
  return c.json({ ok: true });
});

app.delete("/:id", async (c) => {
  const result = await c.env.DB.prepare("DELETE FROM notes WHERE id = ?").bind(c.req.param("id")).run();
  if (result.meta.changes === 0) return c.json({ error: "not_found" }, 404);
  return c.json({ ok: true });
});

export default app;
