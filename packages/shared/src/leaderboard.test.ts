import { describe, it, expect } from "vitest";
import { rankAttempts } from "./leaderboard";

const a = (uid: string, score: number, timeTakenSec: number) => ({ uid, score, timeTakenSec });

describe("rankAttempts", () => {
  it("ranks higher score first", () => {
    const ranked = rankAttempts([a("x", 10, 100), a("y", 20, 100)]);
    expect(ranked.find((r) => r.uid === "y")!.rank).toBe(1);
    expect(ranked.find((r) => r.uid === "x")!.rank).toBe(2);
  });

  it("breaks a score tie by faster time", () => {
    const ranked = rankAttempts([a("slow", 10, 500), a("fast", 10, 200)]);
    expect(ranked.find((r) => r.uid === "fast")!.rank).toBe(1);
    expect(ranked.find((r) => r.uid === "slow")!.rank).toBe(2);
  });

  it("gives identical score+time attempts the same (competition-style) rank", () => {
    const ranked = rankAttempts([a("a", 10, 100), a("b", 10, 100), a("c", 20, 50)]);
    expect(ranked.find((r) => r.uid === "c")!.rank).toBe(1);
    expect(ranked.find((r) => r.uid === "a")!.rank).toBe(2);
    expect(ranked.find((r) => r.uid === "b")!.rank).toBe(2);
  });

  it("skips ranks after a tie (1,2,2,4 not 1,2,2,3)", () => {
    const ranked = rankAttempts([a("a", 10, 100), a("b", 10, 100), a("c", 5, 100)]);
    expect(ranked.find((r) => r.uid === "c")!.rank).toBe(3);
  });

  it("does not mutate the input array", () => {
    const input = [a("x", 10, 100), a("y", 20, 100)];
    const copy = [...input];
    rankAttempts(input);
    expect(input).toEqual(copy);
  });

  it("handles a single attempt", () => {
    expect(rankAttempts([a("solo", 7, 300)])[0]!.rank).toBe(1);
  });

  it("handles an empty list", () => {
    expect(rankAttempts([])).toEqual([]);
  });

  it("preserves extra fields on each attempt alongside rank", () => {
    const ranked = rankAttempts([{ ...a("x", 10, 100), name: "Rafi" }]);
    expect(ranked[0]).toEqual({ uid: "x", score: 10, timeTakenSec: 100, name: "Rafi", rank: 1 });
  });
});
