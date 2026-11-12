import { Hono } from "hono";
import { AttemptSubmit } from "@coaching-app/shared/schema";
import { scoreAttempt, type ScorableQuestion } from "@coaching-app/shared/scoring";
import type { Env } from "../index";

const app = new Hono<{ Bindings: Env; Variables: { uid: string } }>();

app.post("/submit", async (c) => {
  const parsed = AttemptSubmit.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "invalid_input" }, 400);
  const { testId, answers, timeTakenSec } = parsed.data;

  const test = await c.env.DB
    .prepare("SELECT questions_json, negative_mark, duration_sec, closes_at FROM tests WHERE id = ?")
    .bind(testId)
    .first<{ questions_json: string; negative_mark: number; duration_sec: number; closes_at: number | null }>();
  if (!test) return c.json({ error: "test_not_found" }, 404);

  if (test.closes_at && Date.now() / 1000 > test.closes_at) {
    return c.json({ error: "test_closed" }, 409);
  }
  // Server-side time ceiling: the client's own clock is never trusted
  // for scoring, only as a UI timer.
  const hardCap = test.duration_sec + 30; // small grace for network latency
  const effectiveTime = Math.min(timeTakenSec, hardCap);

  const questions: ScorableQuestion[] = JSON.parse(test.questions_json);
  const { score, correct, wrong, skipped } = scoreAttempt(questions, answers, test.negative_mark);

  await c.env.DB
    .prepare(
      `INSERT INTO attempts (id, test_id, uid, answers_json, score, correct_count, wrong_count, skipped_count, time_taken_sec, submitted_at)
       VALUES (lower(hex(randomblob(13))), ?, ?, ?, ?, ?, ?, ?, ?, unixepoch())
       ON CONFLICT(test_id, uid) DO UPDATE SET
         answers_json = excluded.answers_json, score = excluded.score,
         correct_count = excluded.correct_count, wrong_count = excluded.wrong_count,
         skipped_count = excluded.skipped_count, time_taken_sec = excluded.time_taken_sec,
         submitted_at = unixepoch()`,
    )
    .bind(testId, c.get("uid"), JSON.stringify(answers), score, correct, wrong, skipped, effectiveTime)
    .run();

  return c.json({ score, correct, wrong, skipped, totalQuestions: questions.length });
});

export default app;
