import { Hono } from "hono";
import { ulid } from "ulidx";
import { ChapterUpsert, DoubtAnswer, LectureUpsert, NoteUpsert, NoticeUpsert, TestUpsert } from "@coaching-app/shared/schema";
import { requireTeacherAccess } from "../middleware/firebaseAuth";
import type { AppEnv } from "../index";

const app = new Hono<AppEnv>();

app.use("*", requireTeacherAccess());

const MY_BATCHES = "SELECT batch_id FROM batch_teachers WHERE teacher_uid = ?";

async function ownsBatch(db: D1Database, teacherUid: string, batchId: string): Promise<boolean> {
  const row = await db.prepare("SELECT 1 FROM batch_teachers WHERE teacher_uid = ? AND batch_id = ?").bind(teacherUid, batchId).first();
  return Boolean(row);
}

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

// ---------- Chapters (grouping for lectures/notes within a batch+subject) ----------

app.get("/chapters", async (c) => {
  const uid = c.get("uid");
  const batchId = c.req.query("batchId");
  const rows = await c.env.DB
    .prepare(
      batchId
        ? `SELECT ch.id, ch.batch_id, b.title_en AS batch_title_en, ch.subject_id, s.name_en AS subject_name_en,
                  ch.title_bn, ch.title_en, ch.order_index, ch.created_at
           FROM chapters ch JOIN batches b ON b.id = ch.batch_id JOIN subjects s ON s.id = ch.subject_id
           WHERE ch.batch_id = ? AND ch.batch_id IN (${MY_BATCHES}) ORDER BY ch.order_index, ch.created_at`
        : `SELECT ch.id, ch.batch_id, b.title_en AS batch_title_en, ch.subject_id, s.name_en AS subject_name_en,
                  ch.title_bn, ch.title_en, ch.order_index, ch.created_at
           FROM chapters ch JOIN batches b ON b.id = ch.batch_id JOIN subjects s ON s.id = ch.subject_id
           WHERE ch.batch_id IN (${MY_BATCHES}) ORDER BY ch.created_at DESC LIMIT 200`,
    )
    .bind(...(batchId ? [batchId, uid] : [uid]))
    .all();
  return c.json(rows.results);
});

app.post("/chapters", async (c) => {
  const uid = c.get("uid");
  const parsed = ChapterUpsert.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_input", issues: parsed.error.flatten() }, 400);
  const { batchId, subjectId, titleBn, titleEn, orderIndex } = parsed.data;
  if (!(await ownsBatch(c.env.DB, uid, batchId))) return c.json({ error: "not_your_batch" }, 403);

  const id = crypto.randomUUID();
  await c.env.DB
    .prepare(`INSERT INTO chapters (id, batch_id, subject_id, title_bn, title_en, order_index) VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(id, batchId, subjectId, titleBn, titleEn, orderIndex)
    .run();
  return c.json({ ok: true, id });
});

app.put("/chapters/:id", async (c) => {
  const uid = c.get("uid");
  const parsed = ChapterUpsert.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_input", issues: parsed.error.flatten() }, 400);
  const { batchId, subjectId, titleBn, titleEn, orderIndex } = parsed.data;
  if (!(await ownsBatch(c.env.DB, uid, batchId))) return c.json({ error: "not_your_batch" }, 403);

  const result = await c.env.DB
    .prepare(
      `UPDATE chapters SET batch_id = ?, subject_id = ?, title_bn = ?, title_en = ?, order_index = ?
       WHERE id = ? AND batch_id IN (${MY_BATCHES})`,
    )
    .bind(batchId, subjectId, titleBn, titleEn, orderIndex, c.req.param("id"), uid)
    .run();
  if (result.meta.changes === 0) return c.json({ error: "not_found" }, 404);
  return c.json({ ok: true });
});

app.delete("/chapters/:id", async (c) => {
  const uid = c.get("uid");
  const id = c.req.param("id");
  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE lectures SET chapter_id = NULL WHERE chapter_id = ? AND batch_id IN (${MY_BATCHES})`).bind(id, uid),
    c.env.DB.prepare(`UPDATE notes SET chapter_id = NULL WHERE chapter_id = ? AND batch_id IN (${MY_BATCHES})`).bind(id, uid),
  ]);
  const result = await c.env.DB.prepare(`DELETE FROM chapters WHERE id = ? AND batch_id IN (${MY_BATCHES})`).bind(id, uid).run();
  if (result.meta.changes === 0) return c.json({ error: "not_found" }, 404);
  return c.json({ ok: true });
});

// ---------- Lectures (incl. "start a class" via is_live + live_at) ----------

app.get("/lectures", async (c) => {
  const uid = c.get("uid");
  const batchId = c.req.query("batchId");
  const rows = await c.env.DB
    .prepare(
      batchId
        ? `SELECT l.id, l.batch_id, b.title_en AS batch_title_en, l.chapter, l.title_bn, l.title_en,
                  l.youtube_id, l.duration_sec, l.order_index, l.is_live, l.live_at, l.subject_id, l.chapter_id, l.status, l.release_at, l.created_at
           FROM lectures l JOIN batches b ON b.id = l.batch_id
           WHERE l.batch_id = ? AND l.batch_id IN (${MY_BATCHES}) ORDER BY l.order_index, l.created_at`
        : `SELECT l.id, l.batch_id, b.title_en AS batch_title_en, l.chapter, l.title_bn, l.title_en,
                  l.youtube_id, l.duration_sec, l.order_index, l.is_live, l.live_at, l.subject_id, l.chapter_id, l.status, l.release_at, l.created_at
           FROM lectures l JOIN batches b ON b.id = l.batch_id
           WHERE l.batch_id IN (${MY_BATCHES})
           ORDER BY l.live_at IS NULL, l.live_at, l.created_at DESC LIMIT 200`,
    )
    .bind(...(batchId ? [batchId, uid] : [uid]))
    .all();
  return c.json(rows.results);
});

app.post("/lectures", async (c) => {
  const uid = c.get("uid");
  const parsed = LectureUpsert.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_input", issues: parsed.error.flatten() }, 400);
  const { batchId, chapter, titleBn, titleEn, youtubeId, durationSec, orderIndex, isLive, liveAt, subjectId, chapterId, status, releaseAt } = parsed.data;
  if (!(await ownsBatch(c.env.DB, uid, batchId))) return c.json({ error: "not_your_batch" }, 403);

  const id = crypto.randomUUID();
  await c.env.DB
    .prepare(
      `INSERT INTO lectures (id, batch_id, chapter, title_bn, title_en, youtube_id, duration_sec, order_index, is_live, live_at, subject_id, chapter_id, status, release_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id, batchId, chapter, titleBn, titleEn, youtubeId, durationSec ?? null, orderIndex, isLive ? 1 : 0, liveAt ?? null,
      subjectId ?? null, chapterId ?? null, status, releaseAt ?? null,
    )
    .run();

  return c.json({ ok: true, id });
});

app.put("/lectures/:id", async (c) => {
  const uid = c.get("uid");
  const parsed = LectureUpsert.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_input", issues: parsed.error.flatten() }, 400);
  const { batchId, chapter, titleBn, titleEn, youtubeId, durationSec, orderIndex, isLive, liveAt, subjectId, chapterId, status, releaseAt } = parsed.data;
  if (!(await ownsBatch(c.env.DB, uid, batchId))) return c.json({ error: "not_your_batch" }, 403);

  const result = await c.env.DB
    .prepare(
      `UPDATE lectures SET batch_id = ?, chapter = ?, title_bn = ?, title_en = ?, youtube_id = ?,
              duration_sec = ?, order_index = ?, is_live = ?, live_at = ?,
              subject_id = ?, chapter_id = ?, status = ?, release_at = ?
       WHERE id = ? AND batch_id IN (${MY_BATCHES})`,
    )
    .bind(
      batchId, chapter, titleBn, titleEn, youtubeId, durationSec ?? null, orderIndex, isLive ? 1 : 0, liveAt ?? null,
      subjectId ?? null, chapterId ?? null, status, releaseAt ?? null, c.req.param("id"), uid,
    )
    .run();
  if (result.meta.changes === 0) return c.json({ error: "not_found" }, 404);
  return c.json({ ok: true });
});

app.delete("/lectures/:id", async (c) => {
  const uid = c.get("uid");
  const result = await c.env.DB
    .prepare(`DELETE FROM lectures WHERE id = ? AND batch_id IN (${MY_BATCHES})`)
    .bind(c.req.param("id"), uid)
    .run();
  if (result.meta.changes === 0) return c.json({ error: "not_found" }, 404);
  return c.json({ ok: true });
});

// ---------- Materials (notes/DPP/flashcards/formula sheets) ----------

app.get("/materials", async (c) => {
  const uid = c.get("uid");
  const batchId = c.req.query("batchId");
  const rows = await c.env.DB
    .prepare(
      batchId
        ? `SELECT n.id, n.batch_id, b.title_en AS batch_title_en, n.lecture_id, n.chapter_id, n.title_bn, n.title_en,
                  n.drive_file_id, n.kind, n.is_free, n.created_at
           FROM notes n JOIN batches b ON b.id = n.batch_id
           WHERE n.batch_id = ? AND n.batch_id IN (${MY_BATCHES}) ORDER BY n.created_at DESC`
        : `SELECT n.id, n.batch_id, b.title_en AS batch_title_en, n.lecture_id, n.chapter_id, n.title_bn, n.title_en,
                  n.drive_file_id, n.kind, n.is_free, n.created_at
           FROM notes n JOIN batches b ON b.id = n.batch_id
           WHERE n.batch_id IN (${MY_BATCHES})
           ORDER BY n.created_at DESC LIMIT 200`,
    )
    .bind(...(batchId ? [batchId, uid] : [uid]))
    .all();
  return c.json(rows.results);
});

app.post("/materials", async (c) => {
  const uid = c.get("uid");
  const parsed = NoteUpsert.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_input", issues: parsed.error.flatten() }, 400);
  const { batchId, lectureId, chapterId, titleBn, titleEn, driveFileId, kind, isFree } = parsed.data;
  if (!batchId || !(await ownsBatch(c.env.DB, uid, batchId))) return c.json({ error: "not_your_batch" }, 403);

  const id = crypto.randomUUID();
  await c.env.DB
    .prepare(
      `INSERT INTO notes (id, batch_id, lecture_id, chapter_id, title_bn, title_en, drive_file_id, kind, is_free)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, batchId, lectureId ?? null, chapterId ?? null, titleBn, titleEn, driveFileId, kind, isFree ? 1 : 0)
    .run();

  return c.json({ ok: true, id });
});

app.put("/materials/:id", async (c) => {
  const uid = c.get("uid");
  const parsed = NoteUpsert.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_input", issues: parsed.error.flatten() }, 400);
  const { batchId, lectureId, chapterId, titleBn, titleEn, driveFileId, kind, isFree } = parsed.data;
  if (!batchId || !(await ownsBatch(c.env.DB, uid, batchId))) return c.json({ error: "not_your_batch" }, 403);

  const result = await c.env.DB
    .prepare(
      `UPDATE notes SET batch_id = ?, lecture_id = ?, chapter_id = ?, title_bn = ?, title_en = ?, drive_file_id = ?, kind = ?, is_free = ?
       WHERE id = ? AND batch_id IN (${MY_BATCHES})`,
    )
    .bind(batchId, lectureId ?? null, chapterId ?? null, titleBn, titleEn, driveFileId, kind, isFree ? 1 : 0, c.req.param("id"), uid)
    .run();
  if (result.meta.changes === 0) return c.json({ error: "not_found" }, 404);
  return c.json({ ok: true });
});

app.delete("/materials/:id", async (c) => {
  const uid = c.get("uid");
  const result = await c.env.DB
    .prepare(`DELETE FROM notes WHERE id = ? AND batch_id IN (${MY_BATCHES})`)
    .bind(c.req.param("id"), uid)
    .run();
  if (result.meta.changes === 0) return c.json({ error: "not_found" }, 404);
  return c.json({ ok: true });
});

// ---------- Notices (batch-scoped only — a teacher can't post a global notice) ----------

app.get("/notices", async (c) => {
  const uid = c.get("uid");
  const rows = await c.env.DB
    .prepare(
      `SELECT n.id, n.title_bn, n.title_en, n.body_bn, n.body_en, n.batch_id, b.title_en AS batch_title_en,
              n.pinned, n.created_at
       FROM notices n JOIN batches b ON b.id = n.batch_id
       WHERE n.batch_id IN (${MY_BATCHES})
       ORDER BY n.pinned DESC, n.created_at DESC LIMIT 100`,
    )
    .bind(uid)
    .all();
  return c.json(rows.results);
});

app.post("/notices", async (c) => {
  const uid = c.get("uid");
  const parsed = NoticeUpsert.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_input", issues: parsed.error.flatten() }, 400);
  const n = parsed.data;
  if (!n.batchId || !(await ownsBatch(c.env.DB, uid, n.batchId))) return c.json({ error: "not_your_batch" }, 403);

  const id = ulid();
  await c.env.DB
    .prepare(
      `INSERT INTO notices (id, title_bn, title_en, body_bn, body_en, batch_id, pinned)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, n.titleBn, n.titleEn, n.bodyBn ?? null, n.bodyEn ?? null, n.batchId, n.pinned ? 1 : 0)
    .run();
  return c.json({ id }, 201);
});

app.put("/notices/:id", async (c) => {
  const uid = c.get("uid");
  const parsed = NoticeUpsert.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_input", issues: parsed.error.flatten() }, 400);
  const n = parsed.data;
  if (!n.batchId || !(await ownsBatch(c.env.DB, uid, n.batchId))) return c.json({ error: "not_your_batch" }, 403);

  const result = await c.env.DB
    .prepare(
      `UPDATE notices SET title_bn = ?, title_en = ?, body_bn = ?, body_en = ?, batch_id = ?, pinned = ?
       WHERE id = ? AND batch_id IN (${MY_BATCHES})`,
    )
    .bind(n.titleBn, n.titleEn, n.bodyBn ?? null, n.bodyEn ?? null, n.batchId, n.pinned ? 1 : 0, c.req.param("id"), uid)
    .run();
  if (result.meta.changes === 0) return c.json({ error: "not_found" }, 404);
  return c.json({ ok: true });
});

app.delete("/notices/:id", async (c) => {
  const uid = c.get("uid");
  const result = await c.env.DB
    .prepare(`DELETE FROM notices WHERE id = ? AND batch_id IN (${MY_BATCHES})`)
    .bind(c.req.param("id"), uid)
    .run();
  if (result.meta.changes === 0) return c.json({ error: "not_found" }, 404);
  return c.json({ ok: true });
});

// ---------- Tests ----------

app.get("/tests", async (c) => {
  const uid = c.get("uid");
  const batchId = c.req.query("batchId");
  const rows = await c.env.DB
    .prepare(
      batchId
        ? `SELECT t.id, t.batch_id, b.title_en AS batch_title_en, t.title_bn, t.title_en, t.kind,
                  t.duration_sec, t.total_marks, t.negative_mark, t.opens_at, t.closes_at, t.status, t.created_at,
                  (SELECT COUNT(*) FROM attempts a WHERE a.test_id = t.id AND a.submitted_at IS NOT NULL) AS attempt_count
           FROM tests t JOIN batches b ON b.id = t.batch_id
           WHERE t.batch_id = ? AND t.batch_id IN (${MY_BATCHES}) ORDER BY t.created_at DESC`
        : `SELECT t.id, t.batch_id, b.title_en AS batch_title_en, t.title_bn, t.title_en, t.kind,
                  t.duration_sec, t.total_marks, t.negative_mark, t.opens_at, t.closes_at, t.status, t.created_at,
                  (SELECT COUNT(*) FROM attempts a WHERE a.test_id = t.id AND a.submitted_at IS NOT NULL) AS attempt_count
           FROM tests t JOIN batches b ON b.id = t.batch_id
           WHERE t.batch_id IN (${MY_BATCHES})
           ORDER BY t.created_at DESC LIMIT 200`,
    )
    .bind(...(batchId ? [batchId, uid] : [uid]))
    .all();
  return c.json(rows.results);
});

app.get("/tests/:id", async (c) => {
  const uid = c.get("uid");
  const row = await c.env.DB
    .prepare(
      `SELECT id, batch_id, title_bn, title_en, kind, duration_sec, total_marks, negative_mark,
              questions_json, opens_at, closes_at, status
       FROM tests WHERE id = ? AND batch_id IN (${MY_BATCHES})`,
    )
    .bind(c.req.param("id"), uid)
    .first();
  if (!row) return c.json({ error: "not_found" }, 404);
  return c.json(row);
});

function assignTestIds(questions: TestUpsert["questions"]) {
  return questions.map((q) => ({ id: crypto.randomUUID(), ...q }));
}

app.post("/tests", async (c) => {
  const uid = c.get("uid");
  const parsed = TestUpsert.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_input", issues: parsed.error.flatten() }, 400);
  const { batchId, titleBn, titleEn, kind, durationSec, totalMarks, negativeMark, questions, opensAt, closesAt, status } = parsed.data;
  if (!batchId || !(await ownsBatch(c.env.DB, uid, batchId))) return c.json({ error: "not_your_batch" }, 403);

  const id = ulid();
  await c.env.DB
    .prepare(
      `INSERT INTO tests (id, batch_id, title_bn, title_en, kind, duration_sec, total_marks, negative_mark,
              questions_json, opens_at, closes_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      batchId,
      titleBn,
      titleEn,
      kind,
      durationSec,
      totalMarks,
      negativeMark,
      JSON.stringify(assignTestIds(questions)),
      opensAt ?? null,
      closesAt ?? null,
      status,
    )
    .run();

  return c.json({ ok: true, id });
});

app.put("/tests/:id", async (c) => {
  const uid = c.get("uid");
  const parsed = TestUpsert.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_input", issues: parsed.error.flatten() }, 400);
  const { batchId, titleBn, titleEn, kind, durationSec, totalMarks, negativeMark, questions, opensAt, closesAt, status } = parsed.data;
  if (!batchId || !(await ownsBatch(c.env.DB, uid, batchId))) return c.json({ error: "not_your_batch" }, 403);

  const result = await c.env.DB
    .prepare(
      `UPDATE tests SET batch_id = ?, title_bn = ?, title_en = ?, kind = ?, duration_sec = ?, total_marks = ?,
              negative_mark = ?, questions_json = ?, opens_at = ?, closes_at = ?, status = ?
       WHERE id = ? AND batch_id IN (${MY_BATCHES})`,
    )
    .bind(
      batchId,
      titleBn,
      titleEn,
      kind,
      durationSec,
      totalMarks,
      negativeMark,
      JSON.stringify(assignTestIds(questions)),
      opensAt ?? null,
      closesAt ?? null,
      status,
      c.req.param("id"),
      uid,
    )
    .run();
  if (result.meta.changes === 0) return c.json({ error: "not_found" }, 404);
  return c.json({ ok: true });
});

app.delete("/tests/:id", async (c) => {
  const uid = c.get("uid");
  const result = await c.env.DB
    .prepare(`DELETE FROM tests WHERE id = ? AND batch_id IN (${MY_BATCHES})`)
    .bind(c.req.param("id"), uid)
    .run();
  if (result.meta.changes === 0) return c.json({ error: "not_found" }, 404);
  return c.json({ ok: true });
});

export default app;
