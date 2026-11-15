import { Hono } from "hono";
import { ulid } from "ulidx";
import { TestUpsert } from "@coaching-app/shared/schema";
import type { AppEnv } from "../../index";

const app = new Hono<AppEnv>();

app.get("/", async (c) => {
  const batchId = c.req.query("batchId");
  const rows = await c.env.DB
    .prepare(
      batchId
        ? `SELECT t.id, t.batch_id, b.title_en AS batch_title_en, t.title_bn, t.title_en, t.kind,
                  t.duration_sec, t.total_marks, t.negative_mark, t.opens_at, t.closes_at, t.status, t.created_at,
                  (SELECT COUNT(*) FROM attempts a WHERE a.test_id = t.id AND a.submitted_at IS NOT NULL) AS attempt_count
           FROM tests t LEFT JOIN batches b ON b.id = t.batch_id
           WHERE t.batch_id = ? ORDER BY t.created_at DESC`
        : `SELECT t.id, t.batch_id, b.title_en AS batch_title_en, t.title_bn, t.title_en, t.kind,
                  t.duration_sec, t.total_marks, t.negative_mark, t.opens_at, t.closes_at, t.status, t.created_at,
                  (SELECT COUNT(*) FROM attempts a WHERE a.test_id = t.id AND a.submitted_at IS NOT NULL) AS attempt_count
           FROM tests t LEFT JOIN batches b ON b.id = t.batch_id
           ORDER BY t.created_at DESC LIMIT 200`,
    )
    .bind(...(batchId ? [batchId] : []))
    .all();
  return c.json(rows.results);
});

app.get("/:id", async (c) => {
  const row = await c.env.DB
    .prepare(
      `SELECT id, batch_id, title_bn, title_en, kind, duration_sec, total_marks, negative_mark,
              questions_json, opens_at, closes_at, status
       FROM tests WHERE id = ?`,
    )
    .bind(c.req.param("id"))
    .first();
  if (!row) return c.json({ error: "not_found" }, 404);
  return c.json(row);
});

function assignIds(questions: TestUpsert["questions"]) {
  return questions.map((q) => ({ id: crypto.randomUUID(), ...q }));
}

app.post("/", async (c) => {
  const parsed = TestUpsert.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_input", issues: parsed.error.flatten() }, 400);
  const { batchId, titleBn, titleEn, kind, durationSec, totalMarks, negativeMark, questions, opensAt, closesAt, status } = parsed.data;

  const id = ulid();
  await c.env.DB
    .prepare(
      `INSERT INTO tests (id, batch_id, title_bn, title_en, kind, duration_sec, total_marks, negative_mark,
              questions_json, opens_at, closes_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      batchId ?? null,
      titleBn,
      titleEn,
      kind,
      durationSec,
      totalMarks,
      negativeMark,
      JSON.stringify(assignIds(questions)),
      opensAt ?? null,
      closesAt ?? null,
      status,
    )
    .run();

  return c.json({ ok: true, id });
});

app.put("/:id", async (c) => {
  const parsed = TestUpsert.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_input", issues: parsed.error.flatten() }, 400);
  const { batchId, titleBn, titleEn, kind, durationSec, totalMarks, negativeMark, questions, opensAt, closesAt, status } = parsed.data;

  const result = await c.env.DB
    .prepare(
      `UPDATE tests SET batch_id = ?, title_bn = ?, title_en = ?, kind = ?, duration_sec = ?, total_marks = ?,
              negative_mark = ?, questions_json = ?, opens_at = ?, closes_at = ?, status = ?
       WHERE id = ?`,
    )
    .bind(
      batchId ?? null,
      titleBn,
      titleEn,
      kind,
      durationSec,
      totalMarks,
      negativeMark,
      JSON.stringify(assignIds(questions)),
      opensAt ?? null,
      closesAt ?? null,
      status,
      c.req.param("id"),
    )
    .run();
  if (result.meta.changes === 0) return c.json({ error: "not_found" }, 404);
  return c.json({ ok: true });
});

app.delete("/:id", async (c) => {
  const result = await c.env.DB.prepare("DELETE FROM tests WHERE id = ?").bind(c.req.param("id")).run();
  if (result.meta.changes === 0) return c.json({ error: "not_found" }, 404);
  return c.json({ ok: true });
});

export default app;
