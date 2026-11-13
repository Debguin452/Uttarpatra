import { Hono } from "hono";
import { TeacherReview } from "@coaching-app/shared/schema";
import { requireRole } from "../../middleware/firebaseAuth";
import type { AppEnv } from "../../index";

const app = new Hono<AppEnv>();

app.get("/teacher-applications", requireRole("super_admin"), async (c) => {
  const rows = await c.env.DB
    .prepare(
      `SELECT a.uid, u.name, a.subjects, a.qualification, a.experience_years, a.phone, a.bio, a.demo_url, a.created_at
       FROM teacher_applications a JOIN users u ON u.uid = a.uid
       WHERE a.status = 'pending' ORDER BY a.created_at ASC LIMIT 50`,
    )
    .all<{ subjects: string }>();
  return c.json(rows.results.map((row) => ({ ...row, subjects: JSON.parse(row.subjects) as string[] })));
});

app.post("/teacher-applications/review", requireRole("super_admin"), async (c) => {
  const parsed = TeacherReview.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_input" }, 400);
  const { uid, decision, note } = parsed.data;

  const claim = await c.env.DB
    .prepare(
      `UPDATE teacher_applications SET status = ?, review_note = ?, reviewed_by = ?,
         reviewed_at = unixepoch(), updated_at = unixepoch()
       WHERE uid = ? AND status = 'pending'`,
    )
    .bind(decision, note ?? null, c.get("uid"), uid)
    .run();
  if (claim.meta.changes === 0) return c.json({ error: "already_reviewed" }, 409);

  const statements = [
    c.env.DB
      .prepare("INSERT INTO audit_log (actor_uid, action, target, meta_json) VALUES (?, ?, ?, ?)")
      .bind(c.get("uid"), `teacher_application.${decision}`, uid, JSON.stringify({ note })),
  ];
  if (decision === "approved") {
    statements.push(
      c.env.DB.prepare("UPDATE users SET role = 'teacher', updated_at = unixepoch() WHERE uid = ? AND role = 'student'").bind(uid),
    );
  }
  await c.env.DB.batch(statements);
  return c.json({ ok: true });
});

app.get("/teachers", requireRole("super_admin"), async (c) => {
  const rows = await c.env.DB
    .prepare(
      `SELECT u.uid, u.name, u.phone, a.subjects, a.experience_years,
              (SELECT COUNT(*) FROM batch_teachers bt WHERE bt.teacher_uid = u.uid) AS batch_count
       FROM users u LEFT JOIN teacher_applications a ON a.uid = u.uid
       WHERE u.role = 'teacher' ORDER BY u.name LIMIT 100`,
    )
    .all<{ subjects: string | null }>();
  return c.json(rows.results.map((row) => ({ ...row, subjects: row.subjects ? (JSON.parse(row.subjects) as string[]) : null })));
});

app.post("/teachers/:uid/suspend", requireRole("super_admin"), async (c) => {
  const uid = c.req.param("uid");
  if (uid === c.get("uid")) return c.json({ error: "cannot_change_self" }, 400);

  const demoted = await c.env.DB
    .prepare("UPDATE users SET role = 'student', updated_at = unixepoch() WHERE uid = ? AND role = 'teacher'")
    .bind(uid)
    .run();
  if (demoted.meta.changes === 0) return c.json({ error: "not_found" }, 404);

  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM batch_teachers WHERE teacher_uid = ?").bind(uid),
    c.env.DB
      .prepare("UPDATE teacher_applications SET status = 'suspended', updated_at = unixepoch() WHERE uid = ?")
      .bind(uid),
    c.env.DB
      .prepare("INSERT INTO audit_log (actor_uid, action, target) VALUES (?, 'teacher.suspend', ?)")
      .bind(c.get("uid"), uid),
  ]);
  return c.json({ ok: true });
});

export default app;
