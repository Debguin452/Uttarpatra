export type ScorableQuestion = {
  id: string;
  answer: string;
  marks: number;
};

export type AttemptAnswers = Record<string, string | null | undefined>;

export type ScoreResult = {
  score: number;
  correct: number;
  wrong: number;
  skipped: number;
};

/**
 * Pure scoring function used by POST /api/attempts/submit. Kept free of
 * D1/Hono so it can be unit tested directly — the route just loads the
 * test row, calls this, and persists the result.
 *
 * `negativeMark` is a flat per-wrong-answer penalty (not proportional to
 * the question's own `marks`), matching how `tests.negative_mark` is
 * defined in the schema.
 */
export function scoreAttempt(
  questions: ScorableQuestion[],
  answers: AttemptAnswers,
  negativeMark: number,
): ScoreResult {
  let score = 0;
  let correct = 0;
  let wrong = 0;
  let skipped = 0;

  for (const question of questions) {
    const given = answers[question.id];
    if (given == null) {
      skipped++;
    } else if (given === question.answer) {
      score += question.marks;
      correct++;
    } else {
      score -= negativeMark;
      wrong++;
    }
  }

  return { score, correct, wrong, skipped };
}
