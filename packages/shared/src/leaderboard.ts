export type AttemptForRanking = {
  uid: string;
  score: number;
  timeTakenSec: number;
};

/** Higher score wins; a tied score is broken by whoever finished
 *  faster. Used both to sort the leaderboard and to find one
 *  student's own rank within it. */
export function compareForRank(a: AttemptForRanking, b: AttemptForRanking): number {
  if (b.score !== a.score) return b.score - a.score;
  return a.timeTakenSec - b.timeTakenSec;
}

/**
 * Competition-style ranking (1, 2, 2, 4 — not 1, 2, 2, 3): attempts
 * that are truly identical on both score and time share a rank, and
 * the next distinct rank skips ahead to reflect how many people are
 * ahead of it. Does not mutate the input.
 */
export function rankAttempts<T extends AttemptForRanking>(attempts: T[]): (T & { rank: number })[] {
  const sorted = [...attempts].sort(compareForRank);
  let rank = 0;
  let prevScore: number | null = null;
  let prevTime: number | null = null;

  return sorted.map((attempt, i) => {
    if (attempt.score !== prevScore || attempt.timeTakenSec !== prevTime) {
      rank = i + 1;
      prevScore = attempt.score;
      prevTime = attempt.timeTakenSec;
    }
    return { ...attempt, rank };
  });
}
