// Turns the model's reply into questions the test builder accepts. The model is
// asked for a JSON array, but replies are never trusted: anything that is not a
// clean 4-option multiple-choice question with exactly one right answer among
// the options is dropped, and a teacher reviews what is left before it goes live.

export type GeneratedQuestion = {
  subject: string;
  type: "mcq";
  prompt: string;
  options: string[];
  answer: string;
  marks: number;
};

export function parseGeneratedQuestions(
  text: string,
  opts: { subject: string; marks?: number; max?: number },
): { questions: GeneratedQuestion[]; dropped: number } {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start < 0 || end <= start) return { questions: [], dropped: 0 };

  let raw: unknown;
  try {
    raw = JSON.parse(text.slice(start, end + 1));
  } catch {
    return { questions: [], dropped: 0 };
  }
  if (!Array.isArray(raw)) return { questions: [], dropped: 0 };

  const questions: GeneratedQuestion[] = [];
  const seen = new Set<string>();
  let dropped = 0;

  for (const item of raw) {
    const q = item as { prompt?: unknown; options?: unknown; answer?: unknown };
    const prompt = typeof q.prompt === "string" ? q.prompt.trim() : "";
    const options = Array.isArray(q.options) ? q.options.map((o) => (typeof o === "string" ? o.trim() : "")) : [];
    const answer = typeof q.answer === "string" ? q.answer.trim() : "";

    const ok =
      prompt.length > 0 &&
      prompt.length <= 800 &&
      options.length === 4 &&
      options.every((o) => o.length > 0 && o.length <= 300) &&
      new Set(options.map((o) => o.toLowerCase())).size === 4 &&
      options.filter((o) => o === answer).length === 1 &&
      !seen.has(prompt.toLowerCase());

    if (!ok || questions.length >= (opts.max ?? 10)) {
      dropped += 1;
      continue;
    }
    seen.add(prompt.toLowerCase());
    questions.push({ subject: opts.subject, type: "mcq", prompt, options, answer, marks: opts.marks ?? 4 });
  }
  return { questions, dropped };
}
