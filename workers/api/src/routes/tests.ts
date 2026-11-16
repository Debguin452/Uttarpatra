import { Hono } from "hono";
import { rankAttempts } from "@coaching-app/shared/leaderboard";
import type { AppEnv } from "../index";

const app = new Hono<AppEnv>();

const LEADERBOARD_LIMIT = 20;

async function loadRankedAttempts(c: { env: AppEnv["Bindings"] }, testId: string) {
  const rows = await c.env.DB
    .prepare(
      `SELECT a.uid, u.name, a.score, a.time_taken_sec
       FROM attempts a JOIN users u ON u.uid = a.uid
       WHERE a.test_id = ? AND a.submitted_at IS NOT NULL`,
    )
    .bind(testId)
    .all<{ uid: string; name: string; score: number; time_taken_sec: number }>();

  // rankAttempts wants timeTakenSec; shape the DB rows to match, rank
  // once here, and both /result and /leaderboard read off this list —
  // one ranking pass, one source of truth for where everyone stands.
  return rankAttempts(rows.results.map((r) => ({ ...r, timeTakenSec: r.time_taken_sec })));
}

app.get("/", async (c) => {
  const uid = c.get("uid");
  const rows = await c.env.DB
    .prepare(
      `SELECT t.id, t.batch_id, t.title_bn, t.title_en, t.kind, t.duration_sec, t.total_marks,
              t.negative_mark, t.opens_at, t.closes_at, t.status,
              a.score, a.submitted_at
       FROM tests t
       LEFT JOIN attempts a ON a.test_id = t.id AND a.uid = ?1
       WHERE t.status IN ('live', 'closed')
         AND (
           t.batch_id IS NULL
           OR EXISTS (SELECT 1 FROM enrollments e WHERE e.uid = ?1 AND e.batch_id = t.batch_id AND (e.expires_at IS NULL OR e.expires_at > unixepoch()))
           OR EXISTS (SELECT 1 FROM batches b WHERE b.id = t.batch_id AND b.kind = 'free')
         )
       ORDER BY t.created_at DESC LIMIT 100`,
    )
    .bind(uid)
    .all();
  return c.json(rows.results);
});

// A student's own detailed result — score/correct/wrong/skipped/time
// plus their rank, so an already-submitted test is no longer a dead
// end: this is what Test Zone's "view result" re-opens at any time.
app.get("/:id/result", async (c) => {
  const uid = c.get("uid");
  const testId = c.req.param("id");

  const [test, attempt] = await Promise.all([
    c.env.DB
      .prepare("SELECT title_bn, title_en, total_marks FROM tests WHERE id = ?")
      .bind(testId)
      .first<{ title_bn: string; title_en: string; total_marks: number }>(),
    c.env.DB
      .prepare(
        `SELECT score, correct_count, wrong_count, skipped_count, time_taken_sec, submitted_at
         FROM attempts WHERE test_id = ? AND uid = ?`,
      )
      .bind(testId, uid)
      .first<{
        score: number | null;
        correct_count: number | null;
        wrong_count: number | null;
        skipped_count: number | null;
        time_taken_sec: number | null;
        submitted_at: number | null;
      }>(),
  ]);
  if (!test) return c.json({ error: "test_not_found" }, 404);
  if (!attempt || attempt.submitted_at === null) return c.json({ error: "not_submitted" }, 404);

  const ranked = await loadRankedAttempts(c, testId);
  const own = ranked.find((r) => r.uid === uid);

  return c.json({
    titleBn: test.title_bn,
    titleEn: test.title_en,
    totalMarks: test.total_marks,
    score: attempt.score,
    correct: attempt.correct_count,
    wrong: attempt.wrong_count,
    skipped: attempt.skipped_count,
    timeTakenSec: attempt.time_taken_sec,
    rank: own?.rank ?? null,
    totalParticipants: ranked.length,
  });
});

app.get("/:id/leaderboard", async (c) => {
  const testId = c.req.param("id");
  const exists = await c.env.DB.prepare("SELECT 1 FROM tests WHERE id = ?").bind(testId).first();
  if (!exists) return c.json({ error: "test_not_found" }, 404);

  const ranked = await loadRankedAttempts(c, testId);
  return c.json(
    ranked.slice(0, LEADERBOARD_LIMIT).map((r) => ({ rank: r.rank, uid: r.uid, name: r.name, score: r.score })),
  );
});

export default app;
