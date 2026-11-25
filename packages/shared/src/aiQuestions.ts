// Turns the model's reply into questions the test builder accepts. The model is
// asked for a JSON array, but replies are never trusted: anything that is not a
// clean 4-option multiple-choice question with exactly one right answer among
// the options is dropped, and a teacher reviews what is left before it goes live.

import { normalizeAiText } from "./richText";

export type GeneratedQuestion = {
  subject: string;
  type: "mcq";
  prompt: string;
  options: string[];
  answer: string;
  marks: number;
};

/** Plain text for a question field: LaTeX turned into symbols and Markdown marks removed. */
function plain(value: unknown): string {
  if (typeof value !== "string") return "";
  return normalizeAiText(value)
    .replace(/\*\*|__|`/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .trim();
}

const LABEL = /^\(?(?:option\s+)?([A-Da-d]|[1-4])[).:]\s*/i;

/**
 * Models often add labels ("A) ..."), answer with just the letter or number, or change the case.
 * This reads all of those. Nothing is guessed: if the answer cannot be matched to exactly one
 * option, the question is dropped.
 */
function resolveAnswer(options: string[], answerRaw: string): string | null {
  const answer = plain(answerRaw);
  const exact = options.filter((o) => o === answer);
  if (exact.length === 1) return exact[0]!;

  const lower = options.filter((o) => o.toLowerCase() === answer.toLowerCase());
  if (lower.length === 1) return lower[0]!;

  // "B", "b)", "Option C", "(d)", "2"
  const labelOnly = /^\(?(?:option\s+)?([A-Da-d]|[1-4])\)?\.?$/i.exec(answer);
  if (labelOnly) {
    const key = labelOnly[1]!.toUpperCase();
    const index = /\d/.test(key) ? Number(key) - 1 : key.charCodeAt(0) - 65;
    return options[index] ?? null;
  }
  // "B) Joule"
  const labelled = LABEL.exec(answer);
  if (labelled) {
    const rest = answer.slice(labelled[0].length).trim().toLowerCase();
    const hit = options.filter((o) => o.toLowerCase() === rest);
    if (hit.length === 1) return hit[0]!;
  }
  return null;
}

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
    const prompt = plain(q.prompt);
    let options = Array.isArray(q.options) ? q.options.map((o) => plain(o).replace(/\s*\n\s*/g, " ")) : [];
    // labels are stripped only when every option carries one, so real content like "1. Newton" is safe in a mixed list
    if (options.length === 4 && options.every((o) => LABEL.test(o))) options = options.map((o) => o.replace(LABEL, "").trim());
    const answer = options.length === 4 ? resolveAnswer(options, typeof q.answer === "string" ? q.answer : "") : null;

    const ok =
      prompt.length > 0 &&
      prompt.length <= 800 &&
      options.length === 4 &&
      options.every((o) => o.length > 0 && o.length <= 300) &&
      new Set(options.map((o) => o.toLowerCase())).size === 4 &&
      answer !== null &&
      !seen.has(prompt.toLowerCase());

    if (!ok || questions.length >= (opts.max ?? 10)) {
      dropped += 1;
      continue;
    }
    seen.add(prompt.toLowerCase());
    questions.push({ subject: opts.subject, type: "mcq", prompt, options, answer: answer!, marks: opts.marks ?? 4 });
  }
  return { questions, dropped };
}
