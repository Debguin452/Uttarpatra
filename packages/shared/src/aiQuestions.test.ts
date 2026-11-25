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

  it("drops questions whose answer matches none of the options", () => {
    const bad = [{ ...good, answer: "Dyne" }, { ...good, prompt: "Another", answer: "E" }];
    expect(parseGeneratedQuestions(JSON.stringify(bad), { subject: "phy" })).toMatchObject({ questions: [], dropped: 2 });
  });

  it("accepts the answer in a different case", () => {
    expect(parseGeneratedQuestions(JSON.stringify([{ ...good, answer: "newton" }]), { subject: "phy" }).questions[0]!.answer).toBe("Newton");
  });

  it("reads an answer given as a letter or number", () => {
    for (const answer of ["A", "a)", "Option A", "(a)", "1"]) {
      expect(parseGeneratedQuestions(JSON.stringify([{ ...good, answer }]), { subject: "phy" }).questions[0]!.answer).toBe("Newton");
    }
    expect(parseGeneratedQuestions(JSON.stringify([{ ...good, answer: "C" }]), { subject: "phy" }).questions[0]!.answer).toBe("Watt");
  });

  it("strips A) / 1. labels the model added, but only when every option has one", () => {
    const labelled = { ...good, options: ["A) Newton", "B) Joule", "C) Watt", "D) Pascal"], answer: "B) Joule" };
    const r = parseGeneratedQuestions(JSON.stringify([labelled]), { subject: "phy" }).questions[0]!;
    expect(r.options).toEqual(["Newton", "Joule", "Watt", "Pascal"]);
    expect(r.answer).toBe("Joule");
    const mixed = { ...good, prompt: "Mixed", options: ["1. Newton", "Joule", "Watt", "Pascal"], answer: "Joule" };
    expect(parseGeneratedQuestions(JSON.stringify([mixed]), { subject: "phy" }).questions[0]!.options[0]).toBe("1. Newton");
  });

  it("turns LaTeX and Markdown in questions into plain readable text", () => {
    const q = { prompt: "What is **\\(v^{2}\\)** when u = 0?", options: ["\\(2as\\)", "\\(as\\)", "\\(s/a\\)", "\\(a/s\\)"], answer: "\\(2as\\)" };
    const r = parseGeneratedQuestions(JSON.stringify([q]), { subject: "phy" }).questions[0]!;
    expect(r.prompt).toBe("What is v² when u = 0?");
    expect(r.options[0]).toBe("2as");
    expect(r.answer).toBe("2as");
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
