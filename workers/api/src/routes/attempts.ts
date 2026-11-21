import { Hono } from "hono";
import { ulid } from "ulidx";
import { AttemptSubmit, TestStart } from "@coaching-app/shared/schema";
import { scoreAttempt } from "@coaching-app/shared/scoring";
import type { AppEnv } from "../index";

type TestRow = {
  id: string;
  title_bn: string;
  title_en: string;
  duration_sec: number;
  total_marks: number;
  negative_mark: number;
  questions_json: string;
  opens_at: number | null;
  closes_at: number | null;
  status: string;
};

type StoredQuestion = {
  id: string;
  type: string;
  subject: string;
  prompt: string;
  options: string[];
  answer: string;
  marks: number;
};

type AttemptRow = { id: string; started_at: number; submitted_at: number | null; score: number | null };

const SUBMIT_GRACE_SEC = 60;

const app = new Hono<AppEnv>();

async function loadAccessibleTest(c: { env: AppEnv["Bindings"] }, uid: string, testId: string) {
  return c.env.DB
    .prepare(
      `SELECT t.id, t.title_bn, t.title_en, t.duration_sec, t.total_marks, t.negative_mark,
              t.questions_json, t.opens_at, t.closes_at, t.status
       FROM tests t
       WHERE t.id = ?1 AND (
         t.batch_id IS NULL
         OR EXISTS (SELECT 1 FROM enrollments e WHERE e.uid = ?2 AND e.batch_id = t.batch_id AND (e.expires_at IS NULL OR e.expires_at > unixepoch()))
         OR EXISTS (SELECT 1 FROM batches b WHERE b.id = t.batch_id AND b.kind = 'free')
       )`,
    )
    .bind(testId, uid)
    .first<TestRow>();
}

app.post("/start", async (c) => {
  const parsed = TestStart.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_input" }, 400);
  const uid = c.get("uid");
  const nowSec = Math.floor(Date.now() / 1000);

  const test = await loadAccessibleTest(c, uid, parsed.data.testId);
  if (!test) return c.json({ error: "test_not_found" }, 404);
  if (test.status !== "live") return c.json({ error: "test_not_live" }, 409);
  if (test.opens_at && nowSec < test.opens_at) return c.json({ error: "test_not_open" }, 409);
  if (test.closes_at && nowSec > test.closes_at) return c.json({ error: "test_closed" }, 409);

  await c.env.DB
    .prepare("INSERT OR IGNORE INTO attempts (id, test_id, uid, started_at) VALUES (?, ?, ?, ?)")
    .bind(ulid(), test.id, uid, nowSec)
    .run();

  const attempt = await c.env.DB
    .prepare("SELECT id, started_at, submitted_at, score FROM attempts WHERE test_id = ? AND uid = ?")
    .bind(test.id, uid)
    .first<AttemptRow>();
  if (!attempt) return c.json({ error: "attempt_failed" }, 500);
  if (attempt.submitted_at) {
    return c.json({ error: "already_submitted", score: attempt.score, totalMarks: test.total_marks }, 409);
  }

  const questions = (JSON.parse(test.questions_json) as StoredQuestion[]).map(
    ({ id, type, subject, prompt, options, marks }) => ({ id, type, subject, prompt, options, marks }),
  );

  return c.json({
    attemptId: attempt.id,
    testId: test.id,
    titleBn: test.title_bn,
    titleEn: test.title_en,
    startedAt: attempt.started_at,
    serverNow: nowSec,
    durationSec: test.duration_sec,
    totalMarks: test.total_marks,
    negativeMark: test.negative_mark,
    questions,
  });
});

app.post("/submit", async (c) => {
  const parsed = AttemptSubmit.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_input" }, 400);
  const uid = c.get("uid");
  const nowSec = Math.floor(Date.now() / 1000);

  const test = await loadAccessibleTest(c, uid, parsed.data.testId);
  if (!test) return c.json({ error: "test_not_found" }, 404);

  const attempt = await c.env.DB
    .prepare("SELECT id, started_at, submitted_at, score FROM attempts WHERE test_id = ? AND uid = ?")
    .bind(test.id, uid)
    .first<AttemptRow>();
  if (!attempt) return c.json({ error: "not_started" }, 409);
  if (attempt.submitted_at) return c.json({ error: "already_submitted", score: attempt.score }, 409);

  const questions = JSON.parse(test.questions_json) as StoredQuestion[];
  const elapsed = nowSec - attempt.started_at;
  const onTime = elapsed <= test.duration_sec + SUBMIT_GRACE_SEC;

  const validIds = new Set(questions.map((q) => q.id));
  const answers = onTime
    ? Object.fromEntries(Object.entries(parsed.data.answers).filter(([id]) => validIds.has(id)))
    : {};

  const { score, correct, wrong, skipped } = scoreAttempt(questions, answers, test.negative_mark);
  const timeTakenSec = Math.min(elapsed, test.duration_sec);

  const result = await c.env.DB
    .prepare(
      `UPDATE attempts SET answers_json = ?, score = ?, correct_count = ?, wrong_count = ?,
         skipped_count = ?, time_taken_sec = ?, submitted_at = ?
       WHERE id = ? AND submitted_at IS NULL`,
    )
    .bind(JSON.stringify(answers), score, correct, wrong, skipped, timeTakenSec, nowSec, attempt.id)
    .run();
  if (result.meta.changes === 0) return c.json({ error: "already_submitted" }, 409);

  return c.json({
    score,
    correct,
    wrong,
    skipped,
    totalQuestions: questions.length,
    totalMarks: test.total_marks,
    timeTakenSec,
    onTime,
  });
});

// The student's own answers beside the right ones, once the test is submitted.
app.get("/:testId/review", async (c) => {
  const uid = c.get("uid");
  const attempt = await c.env.DB
    .prepare("SELECT answers_json FROM attempts WHERE test_id = ? AND uid = ? AND submitted_at IS NOT NULL")
    .bind(c.req.param("testId"), uid)
    .first<{ answers_json: string | null }>();
  if (!attempt) return c.json({ error: "not_found" }, 404);

  const test = await c.env.DB
    .prepare("SELECT questions_json FROM tests WHERE id = ?")
    .bind(c.req.param("testId"))
    .first<{ questions_json: string }>();
  if (!test) return c.json({ error: "not_found" }, 404);

  const answers = JSON.parse(attempt.answers_json ?? "{}") as Record<string, string | null>;
  const questions = (JSON.parse(test.questions_json) as StoredQuestion[]).map((q) => {
    const yours = answers[q.id] ?? null;
    return {
      id: q.id,
      subject: q.subject,
      prompt: q.prompt,
      options: q.options,
      answer: q.answer,
      marks: q.marks,
      yourAnswer: yours,
      correct: yours === null ? null : yours === q.answer,
    };
  });
  return c.json({ questions });
});

export default app;
