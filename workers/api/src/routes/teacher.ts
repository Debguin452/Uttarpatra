import { Hono } from "hono";
import { DoubtAnswer } from "@coaching-app/shared/schema";
import { requireRole } from "../middleware/firebaseAuth";
import type { AppEnv } from "../index";

const app = new Hono<AppEnv>();

app.use("*", requireRole("teacher"));

const MY_BATCHES = "SELECT batch_id FROM batch_teachers WHERE teacher_uid = ?";

app.get("/students", async (c) => {
  const uid = c.get("uid");
  const rows = await c.env.DB
    .prepare(
      `SELECT u.uid, u.name, u.phone, u.student_class,
              COUNT(e.batch_id) AS batches_with_me
       FROM enrollments e JOIN users u ON u.uid = e.uid
       WHERE e.batch_id IN (${MY_BATCHES})
       GROUP BY u.uid ORDER BY u.name LIMIT 300`,
    )
    .bind(uid)
    .all();
  return c.json(rows.results);
});

app.get("/students/:uid", async (c) => {
  const teacherUid = c.get("uid");
  const studentUid = c.req.param("uid");

  const [student, enrollments, attempts] = await Promise.all([
    c.env.DB
      .prepare(
        `SELECT DISTINCT u.uid, u.name, u.phone, u.student_class, u.board, u.school
         FROM users u JOIN enrollments e ON e.uid = u.uid
         WHERE u.uid = ? AND e.batch_id IN (${MY_BATCHES})`,
      )
      .bind(studentUid, teacherUid)
      .first(),
    c.env.DB
      .prepare(
        `SELECT e.batch_id, b.title_bn, b.title_en, e.created_at
         FROM enrollments e JOIN batches b ON b.id = e.batch_id
         WHERE e.uid = ? AND e.batch_id IN (${MY_BATCHES})`,
      )
      .bind(studentUid, teacherUid)
      .all(),
    c.env.DB
      .prepare(
        `SELECT t.title_bn, t.title_en, a.score, a.correct_count, a.wrong_count, a.submitted_at
         FROM attempts a JOIN tests t ON t.id = a.test_id
         WHERE a.uid = ? AND a.submitted_at IS NOT NULL AND t.batch_id IN (${MY_BATCHES})
         ORDER BY a.submitted_at DESC LIMIT 20`,
      )
      .bind(studentUid, teacherUid)
      .all(),
  ]);
  if (!student) return c.json({ error: "not_found" }, 404);

  return c.json({ student, enrollments: enrollments.results, attempts: attempts.results });
});

app.get("/doubts", async (c) => {
  const uid = c.get("uid");
  const rows = await c.env.DB
    .prepare(
      `SELECT d.id, d.uid, u.name, d.batch_id, b.title_en AS batch_title_en, d.subject, d.question_text,
              d.image_drive_id, d.status, d.answer_text, d.created_at
       FROM doubts d JOIN users u ON u.uid = d.uid LEFT JOIN batches b ON b.id = d.batch_id
       WHERE d.batch_id IN (${MY_BATCHES})
       ORDER BY (d.status = 'open') DESC, d.created_at DESC LIMIT 100`,
    )
    .bind(uid)
    .all();
  return c.json(rows.results);
});

app.post("/doubts/:id/answer", async (c) => {
  const parsed = DoubtAnswer.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_input" }, 400);
  const uid = c.get("uid");
  const doubtId = c.req.param("id");

  const result = await c.env.DB
    .prepare(
      `UPDATE doubts SET status = 'answered', answered_by = ?, answer_text = ?
       WHERE id = ? AND batch_id IN (${MY_BATCHES})`,
    )
    .bind(uid, parsed.data.answerText, doubtId, uid)
    .run();
  if (result.meta.changes === 0) return c.json({ error: "not_found" }, 404);
  return c.json({ ok: true });
});

export default app;
