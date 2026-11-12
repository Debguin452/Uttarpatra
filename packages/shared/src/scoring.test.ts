import { describe, it, expect } from "vitest";
import { scoreAttempt } from "./scoring";

const q = (id: string, answer: string, marks = 4) => ({ id, answer, marks });

describe("scoreAttempt", () => {
  it("awards full marks for a correct answer", () => {
    const result = scoreAttempt([q("q1", "b")], { q1: "b" }, 1);
    expect(result).toEqual({ score: 4, correct: 1, wrong: 0, skipped: 0 });
  });

  it("subtracts the negative mark for a wrong answer", () => {
    const result = scoreAttempt([q("q1", "b")], { q1: "a" }, 1);
    expect(result).toEqual({ score: -1, correct: 0, wrong: 1, skipped: 0 });
  });

  it("gives zero for a skipped question (answer is null)", () => {
    const result = scoreAttempt([q("q1", "b")], { q1: null }, 1);
    expect(result).toEqual({ score: 0, correct: 0, wrong: 0, skipped: 1 });
  });

  it("treats a missing answer key the same as a skip", () => {
    const result = scoreAttempt([q("q1", "b")], {}, 1);
    expect(result).toEqual({ score: 0, correct: 0, wrong: 0, skipped: 1 });
  });

  it("mixes correct/wrong/skipped across many questions with per-question marks", () => {
    const questions = [q("q1", "a", 4), q("q2", "b", 4), q("q3", "c", 8)];
    const answers = { q1: "a", q2: "x", q3: null };
    const result = scoreAttempt(questions, answers, 1);
    // +4 (correct) -1 (wrong) +0 (skipped) = 3
    expect(result).toEqual({ score: 3, correct: 1, wrong: 1, skipped: 1 });
  });

  it("supports fractional negative marking (e.g. JEE-style 0.25)", () => {
    const result = scoreAttempt([q("q1", "b", 4)], { q1: "a" }, 0.25);
    expect(result.score).toBeCloseTo(-0.25);
  });

  it("never lets the negative mark apply to a correct answer", () => {
    const result = scoreAttempt([q("q1", "b", 4)], { q1: "b" }, 1);
    expect(result.wrong).toBe(0);
    expect(result.score).toBe(4);
  });

  it("returns a zero score for an empty question set", () => {
    const result = scoreAttempt([], {}, 1);
    expect(result).toEqual({ score: 0, correct: 0, wrong: 0, skipped: 0 });
  });
});
