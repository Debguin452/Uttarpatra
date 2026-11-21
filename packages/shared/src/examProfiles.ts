// What "the right exam style" means for the AI. Each profile is a short, human-
// readable set of rules that is put in front of the model, so doubts, test
// explanations and generated questions follow the board's or exam's own
// conventions. Only patterns that were checked against official or widely
// reported 2026 sources are written down; anything else falls back to the
// careful generic profile rather than a guess.
//
// Checked November 2026:
//  - WBCHSE Class 12: Semester 3 is MCQ (1 mark each, no negative marking, OMR),
//    Semester 4 is written. Source: WBCHSE "Question Patterns - Class XII, Semester 3".
//  - NEET UG 2026: 180 compulsory MCQs, 720 marks, +4/-1, NCERT Class 11-12.
//  - JEE Main 2026 Paper 1: 75 questions (20 MCQ + 5 numerical value per subject), 300 marks.
// Re-check these each year before the exam season.

export const EXAM_PROFILE_KEYS = ["wbchse_sem3", "wbchse_sem4", "neet", "jee_main", "board_general"] as const;
export type ExamProfileKey = (typeof EXAM_PROFILE_KEYS)[number];

export type ExamProfile = {
  key: ExamProfileKey;
  label_en: string;
  label_bn: string;
  /** Can the question generator write this paper's questions? Only multiple-choice patterns can be generated. */
  mcq: boolean;
  marksPerMcq: number;
  verifiedOn: string;
  rules: string[];
};

const COMMON_STYLE = [
  "Use SI units and standard symbols. Write chemical names by IUPAC rules and balance every equation.",
  "Stay inside the syllabus of the exam. If the topic is outside it, say so instead of answering at a higher level.",
  "Prefer the textbook's own terms and definitions over coined wording.",
];

export const EXAM_PROFILES: Record<ExamProfileKey, ExamProfile> = {
  wbchse_sem3: {
    key: "wbchse_sem3",
    label_en: "WBCHSE Class 12, Semester 3 (MCQ)",
    label_bn: "WBCHSE দ্বাদশ শ্রেণি, সেমিস্টার ৩ (MCQ)",
    mcq: true,
    marksPerMcq: 1,
    verifiedOn: "2026-11",
    rules: [
      "This is the West Bengal Council of Higher Secondary Education (WBCHSE) Class 12 Semester 3 paper: objective only, answered on an OMR sheet.",
      "Every question is a multiple-choice question worth 1 mark with exactly four options and exactly one correct option. There is no negative marking.",
      "Questions come from the prescribed WBCHSE Class 12 Semester 3 syllabus and are spread over topics as in WBCHSE's published question pattern. Keep each question to one clear idea, answerable directly from the textbook.",
      "Avoid 'all of the above' and 'none of the above'. Make wrong options plausible, not silly, and never overlapping.",
      ...COMMON_STYLE,
    ],
  },
  wbchse_sem4: {
    key: "wbchse_sem4",
    label_en: "WBCHSE Class 12, Semester 4 (written)",
    label_bn: "WBCHSE দ্বাদশ শ্রেণি, সেমিস্টার ৪ (লিখিত)",
    mcq: false,
    marksPerMcq: 1,
    verifiedOn: "2026-11",
    rules: [
      "This is the WBCHSE Class 12 Semester 4 paper: a written paper with short and descriptive answers. Some sections give a choice between questions, and the marks per question differ by subject.",
      "Write answers the way a board answer is written: match the depth to the marks (about as many distinct points as marks, longer and structured for higher-mark questions).",
      "Give definitions in textbook words, derivations step by step with each step justified, reactions as balanced equations with conditions, and describe any diagram the answer needs (labels in order).",
      "Finish numerical answers with the final value and its unit.",
      ...COMMON_STYLE,
    ],
  },
  neet: {
    key: "neet",
    label_en: "NEET UG",
    label_bn: "NEET UG",
    mcq: true,
    marksPerMcq: 4,
    verifiedOn: "2026-11",
    rules: [
      "This is NEET UG as conducted by the National Testing Agency: 180 compulsory multiple-choice questions, 720 marks, +4 for a correct answer and -1 for a wrong one, 45 questions each from Physics, Chemistry, Botany and Zoology.",
      "Every question has four options with a single correct option. The syllabus is NCERT Class 11 and Class 12; most questions are built on NCERT lines and diagrams, so use NCERT terms and facts.",
      "Question styles that appear are direct recall, concept application, numerical, statement-based (Statement I and II), match-the-following and assertion-reason. Vary the style but keep one correct option.",
      "Make distractors common mistakes, not absurd values.",
      ...COMMON_STYLE,
    ],
  },
  jee_main: {
    key: "jee_main",
    label_en: "JEE Main (Paper 1)",
    label_bn: "JEE Main (পেপার ১)",
    mcq: true,
    marksPerMcq: 4,
    verifiedOn: "2026-11",
    rules: [
      "This is JEE Main Paper 1 (B.E./B.Tech) by the National Testing Agency: Physics, Chemistry and Mathematics with 25 compulsory questions each, 20 multiple-choice (four options, single correct, +4 and -1) and 5 numerical-value questions, 300 marks in all.",
      "Do not state whether numerical-value questions carry negative marking: reports differ, so tell the student to check the official NTA bulletin.",
      "The syllabus is the JEE Main syllabus built on NCERT Class 11 and 12. Questions are application-heavy and multi-step; keep numbers clean enough to solve by hand.",
      "For numerical answers give the final number to the precision the question asks for.",
      ...COMMON_STYLE,
    ],
  },
  board_general: {
    key: "board_general",
    label_en: "School board (general)",
    label_bn: "স্কুল বোর্ড (সাধারণ)",
    mcq: true,
    marksPerMcq: 1,
    verifiedOn: "2026-11",
    rules: [
      "Follow the official syllabus and prescribed textbooks of the student's board and class. If unsure which board applies, say what you assumed.",
      "Multiple-choice questions have four options and one correct option. Do not assume negative marking.",
      "For written answers, match the depth to the marks asked and follow the textbook's wording.",
      ...COMMON_STYLE,
    ],
  },
};

export function isProfileKey(value: unknown): value is ExamProfileKey {
  return typeof value === "string" && (EXAM_PROFILE_KEYS as readonly string[]).includes(value);
}

/**
 * Picks a sensible default for a student from what they told us at sign-up. They
 * can always choose another style in the app. From November to March a Class 12
 * WBCHSE student is preparing for the written Semester 4 paper.
 */
export function defaultProfile(input: {
  board?: string | null;
  studentClass?: string | null;
  goal?: string | null;
  month?: number; // 1-12
}): ExamProfileKey {
  const goal = (input.goal ?? "").toLowerCase();
  if (goal === "neet") return "neet";
  if (goal === "jee") return "jee_main";

  const board = (input.board ?? "").toLowerCase();
  const cls = (input.studentClass ?? "").toLowerCase();
  const isHs = /wbchse|\bhs\b|higher secondary|west bengal/.test(board);
  const isTwelve = /(^|\D)12(\D|$)|xii|twelve/.test(cls);
  if (isHs && isTwelve) {
    const month = input.month ?? new Date().getUTCMonth() + 1;
    return month >= 11 || month <= 3 ? "wbchse_sem4" : "wbchse_sem3";
  }
  return "board_general";
}

/** The block of rules that goes into the model's instructions. */
export function profilePrompt(key: ExamProfileKey): string {
  const p = EXAM_PROFILES[key];
  return `EXAM STYLE: ${p.label_en}\n${p.rules.map((r) => `- ${r}`).join("\n")}`;
}
