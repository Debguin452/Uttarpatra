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

app.get("/teachers/:uid", requireRole("super_admin"), async (c) => {
  const uid = c.req.param("uid");

  const teacher = await c.env.DB
    .prepare(
      `SELECT u.uid, u.name, u.phone, a.subjects, a.qualification, a.experience_years
       FROM users u LEFT JOIN teacher_applications a ON a.uid = u.uid
       WHERE u.uid = ? AND u.role = 'teacher'`,
    )
    .bind(uid)
    .first<{ subjects: string | null }>();
  if (!teacher) return c.json({ error: "not_found" }, 404);

  const [batches, studentCount, doubtsAnswered, avgScore] = await Promise.all([
    c.env.DB
      .prepare(
        `SELECT bt.batch_id, b.title_bn, b.title_en, bt.subject,
                (SELECT COUNT(*) FROM enrollments e WHERE e.batch_id = bt.batch_id) AS enrolled
         FROM batch_teachers bt JOIN batches b ON b.id = bt.batch_id
         WHERE bt.teacher_uid = ? ORDER BY b.title_en`,
      )
      .bind(uid)
      .all(),
    c.env.DB
      .prepare(
        `SELECT COUNT(DISTINCT e.uid) AS n FROM enrollments e
         WHERE e.batch_id IN (SELECT batch_id FROM batch_teachers WHERE teacher_uid = ?)`,
      )
      .bind(uid)
      .first<{ n: number }>(),
    c.env.DB.prepare("SELECT COUNT(*) AS n FROM doubts WHERE answered_by = ?").bind(uid).first<{ n: number }>(),
    c.env.DB
      .prepare(
        `SELECT AVG(a.score) AS avg FROM attempts a JOIN tests t ON t.id = a.test_id
         WHERE a.submitted_at IS NOT NULL AND t.batch_id IN (SELECT batch_id FROM batch_teachers WHERE teacher_uid = ?)`,
      )
      .bind(uid)
      .first<{ avg: number | null }>(),
  ]);

  return c.json({
    teacher: { ...teacher, subjects: teacher.subjects ? (JSON.parse(teacher.subjects) as string[]) : null },
    batches: batches.results,
    studentCount: studentCount?.n ?? 0,
    doubtsAnswered: doubtsAnswered?.n ?? 0,
    avgStudentScore: avgScore?.avg ?? null,
  });
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
