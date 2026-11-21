import { describe, expect, it } from "vitest";
import { parseGeneratedQuestions } from "./aiQuestions";

const good = { prompt: "SI unit of force?", options: ["Newton", "Joule", "Watt", "Pascal"], answer: "Newton" };

describe("parseGeneratedQuestions", () => {
  it("accepts clean questions and tags them with the subject", () => {
    const { questions, dropped } = parseGeneratedQuestions(JSON.stringify([good]), { subject: "phy" });
    expect(dropped).toBe(0);
    expect(questions).toEqual([{ ...good, subject: "phy", type: "mcq", marks: 4 }]);
  });

  it("copes with prose or a code fence around the array", () => {
    const wrapped = "Here you go:\n```json\n" + JSON.stringify([good]) + "\n```\nHope it helps!";
    expect(parseGeneratedQuestions(wrapped, { subject: "phy" }).questions).toHaveLength(1);
  });

  it("drops questions whose answer is not exactly one of the options", () => {
    const bad = [{ ...good, answer: "newton" }, { ...good, prompt: "Another", answer: "Dyne" }];
    expect(parseGeneratedQuestions(JSON.stringify(bad), { subject: "phy" })).toMatchObject({ questions: [], dropped: 2 });
  });

  it("drops the wrong number of options, duplicates and empty text", () => {
    const bad = [
      { ...good, prompt: "Three", options: ["a", "b", "c"], answer: "a" },
      { ...good, prompt: "Dupes", options: ["a", "A", "b", "c"], answer: "a" },
      { ...good, prompt: "  ", },
      { prompt: "No options" },
    ];
    expect(parseGeneratedQuestions(JSON.stringify(bad), { subject: "x" }).questions).toHaveLength(0);
  });

  it("drops repeated questions and respects the maximum", () => {
    const many = [good, good, ...[1, 2, 3].map((n) => ({ ...good, prompt: `Q${n}` }))];
    const { questions } = parseGeneratedQuestions(JSON.stringify(many), { subject: "x", max: 3 });
    expect(questions).toHaveLength(3);
  });

  it("returns nothing, not an error, for garbage", () => {
    for (const text of ["", "no json here", "[not json]", '{"a":1}']) {
      expect(parseGeneratedQuestions(text, { subject: "x" }).questions).toEqual([]);
    }
  });
});
