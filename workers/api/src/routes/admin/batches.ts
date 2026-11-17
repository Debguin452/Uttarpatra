import { Hono } from "hono";
import { BatchUpsert, TeacherAssign } from "@coaching-app/shared/schema";
import { requireRole } from "../../middleware/firebaseAuth";
import type { AppEnv } from "../../index";

const app = new Hono<AppEnv>();

const audit = (db: D1Database, actor: string, action: string, target: string, meta?: unknown) =>
  db
    .prepare("INSERT INTO audit_log (actor_uid, action, target, meta_json) VALUES (?, ?, ?, ?)")
    .bind(actor, action, target, meta === undefined ? null : JSON.stringify(meta));

const COLUMNS = `title_bn, title_en, track, kind, price_paise, summary_bn, summary_en, preview_video_id, banner_url, status`;

app.get("/", async (c) => {
  const rows = await c.env.DB
    .prepare(
      `SELECT b.id, b.title_bn, b.title_en, b.track, b.kind, b.price_paise, b.status, b.created_at,
              (SELECT COUNT(*) FROM enrollments e WHERE e.batch_id = b.id) AS enrollment_count,
              (SELECT COUNT(*) FROM batch_teachers t WHERE t.batch_id = b.id) AS teacher_count
       FROM batches b ORDER BY b.created_at DESC`,
    )
    .all();
  return c.json(rows.results);
});

app.get("/:id", async (c) => {
  const id = c.req.param("id");
  const [batch, teachers] = await Promise.all([
    c.env.DB.prepare(`SELECT id, ${COLUMNS}, created_at, updated_at FROM batches WHERE id = ?`).bind(id).first(),
    c.env.DB
      .prepare(
        `SELECT t.teacher_uid AS uid, u.name, t.subject
         FROM batch_teachers t JOIN users u ON u.uid = t.teacher_uid
         WHERE t.batch_id = ? ORDER BY u.name`,
      )
      .bind(id)
      .all(),
  ]);
  if (!batch) return c.json({ error: "not_found" }, 404);
  return c.json({ batch, teachers: teachers.results });
});

app.post("/", requireRole("super_admin"), async (c) => {
  const parsed = BatchUpsert.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_input", issues: parsed.error.flatten() }, 400);
  const b = parsed.data;

  const exists = await c.env.DB.prepare("SELECT 1 FROM batches WHERE id = ?").bind(b.id).first();
  if (exists) return c.json({ error: "batch_id_taken" }, 409);

  await c.env.DB.batch([
    c.env.DB
      .prepare(`INSERT INTO batches (id, ${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(
        b.id,
        b.titleBn,
        b.titleEn,
        b.track,
        b.kind,
        b.pricePaise,
        b.summaryBn ?? null,
        b.summaryEn ?? null,
        b.previewVideoId ?? null,
        b.bannerUrl ?? null,
        b.status,
      ),
    audit(c.env.DB, c.get("uid"), "batch.create", b.id, { status: b.status }),
  ]);
  return c.json({ id: b.id }, 201);
});

app.put("/:id", requireRole("super_admin"), async (c) => {
  const parsed = BatchUpsert.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_input", issues: parsed.error.flatten() }, 400);
  const b = parsed.data;
  const id = c.req.param("id");

  const claim = await c.env.DB
    .prepare(
      `UPDATE batches SET title_bn = ?, title_en = ?, track = ?, kind = ?, price_paise = ?,
              summary_bn = ?, summary_en = ?, preview_video_id = ?, banner_url = ?, status = ?, updated_at = unixepoch()
       WHERE id = ?`,
    )
    .bind(
      b.titleBn,
      b.titleEn,
      b.track,
      b.kind,
      b.pricePaise,
      b.summaryBn ?? null,
      b.summaryEn ?? null,
      b.previewVideoId ?? null,
      b.bannerUrl ?? null,
      b.status,
      id,
    )
    .run();
  if (claim.meta.changes === 0) return c.json({ error: "not_found" }, 404);

  await audit(c.env.DB, c.get("uid"), "batch.update", id, { status: b.status, pricePaise: b.pricePaise }).run();
  return c.json({ ok: true });
});

app.post("/:id/teachers", requireRole("super_admin"), async (c) => {
  const parsed = TeacherAssign.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_input" }, 400);
  const { uid, subject } = parsed.data;
  const batchId = c.req.param("id");

  const [batch, teacher, knownSubject] = await Promise.all([
    c.env.DB.prepare("SELECT 1 FROM batches WHERE id = ?").bind(batchId).first(),
    c.env.DB
      .prepare("SELECT role, is_teacher FROM users WHERE uid = ?")
      .bind(uid)
      .first<{ role: string; is_teacher: number }>(),
    subject ? c.env.DB.prepare("SELECT 1 FROM subjects WHERE id = ?").bind(subject).first() : Promise.resolve(true),
  ]);
  if (!batch) return c.json({ error: "not_found" }, 404);
  const isAdmin = teacher?.role === "support" || teacher?.role === "super_admin";
  if (teacher?.role !== "teacher" && !(isAdmin && teacher?.is_teacher)) {
    return c.json({ error: "not_a_teacher" }, 400);
  }
  if (!knownSubject) return c.json({ error: "invalid_subject" }, 400);

  await c.env.DB.batch([
    c.env.DB
      .prepare(
        `INSERT INTO batch_teachers (batch_id, teacher_uid, subject) VALUES (?, ?, ?)
         ON CONFLICT(batch_id, teacher_uid) DO UPDATE SET subject = excluded.subject`,
      )
      .bind(batchId, uid, subject ?? null),
    audit(c.env.DB, c.get("uid"), "batch.assign_teacher", batchId, { uid, subject }),
  ]);
  return c.json({ ok: true });
});

app.delete("/:id/teachers/:uid", requireRole("super_admin"), async (c) => {
  const batchId = c.req.param("id");
  const uid = c.req.param("uid");

  const claim = await c.env.DB
    .prepare("DELETE FROM batch_teachers WHERE batch_id = ? AND teacher_uid = ?")
    .bind(batchId, uid)
    .run();
  if (claim.meta.changes === 0) return c.json({ error: "not_found" }, 404);

  await audit(c.env.DB, c.get("uid"), "batch.unassign_teacher", batchId, { uid }).run();
  return c.json({ ok: true });
});

export default app;
