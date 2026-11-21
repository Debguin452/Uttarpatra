import { Hono, type Context } from "hono";
import { AiChat, AiExplain, AiQuestions } from "@coaching-app/shared/schema";
import { parseGeneratedQuestions } from "@coaching-app/shared/aiQuestions";
import { defaultProfile, EXAM_PROFILES, isProfileKey, type ExamProfileKey } from "@coaching-app/shared/examProfiles";
import { sanitizeUserText } from "@coaching-app/shared/aiGuard";
import type { AppEnv } from "../index";
import {
  AiError,
  DOUBT_SYSTEM,
  EXPLAIN_SYSTEM,
  QUESTIONS_SYSTEM,
  inLiveTest,
  limitsFor,
  refund,
  remainingToday,
  reserve,
  runGuarded,
  screenInput,
  systemFor,
} from "../lib/ai";

const app = new Hono<AppEnv>();

const ADMIN_ROLES = ["support", "super_admin"];
const isStaff = (role: string, isTeacher: boolean) => role === "teacher" || isTeacher || ADMIN_ROLES.includes(role);
const staff = (c: Context<AppEnv>) => isStaff(c.get("role"), c.get("isTeacher"));

app.get("/status", async (c) => {
  const limits = limitsFor(c.env, staff(c));
  return c.json({ enabled: Boolean(c.env.AI), limit: limits.user, remaining: await remainingToday(c.env.DB, c.get("uid"), limits.user) });
});

// Runs the model under the daily caps: takes a use first, hands it back if the model fails.
async function withQuota<T>(
  c: Context<AppEnv>,
  work: () => Promise<T>,
): Promise<{ ok: true; value: T; remaining: number } | { ok: false; status: 429 | 503; error: string }> {
  const uid = c.get("uid");
  const taken = await reserve(c.env.DB, uid, limitsFor(c.env, staff(c)));
  if (!taken.ok) return { ok: false, status: 429, error: taken.reason === "global" ? "ai_busy" : "ai_limit_reached" };
  try {
    return { ok: true, value: await work(), remaining: taken.remaining };
  } catch (error) {
    await refund(c.env.DB, uid);
    if (!(error instanceof AiError)) console.error("ai route failed", error);
    return { ok: false, status: 503, error: "ai_unavailable" };
  }
}

type Student = { board: string | null; student_class: string | null; goal: string | null };

/** The exam style to answer in: what the person picked, else what suits their board, class and goal. */
async function styleFor(c: Context<AppEnv>, picked: unknown): Promise<ExamProfileKey> {
  if (isProfileKey(picked)) return picked;
  const user = await c.env.DB
    .prepare("SELECT board, student_class, goal FROM users WHERE uid = ?")
    .bind(c.get("uid"))
    .first<Student>();
  return defaultProfile({ board: user?.board, studentClass: user?.student_class, goal: user?.goal });
}

// Students do not get AI help in the middle of a timed test. Staff are not affected.
async function testInProgress(c: Context<AppEnv>): Promise<boolean> {
  return !staff(c) && (await inLiveTest(c.env.DB, c.get("uid")));
}

// ---- chat: ask the AI directly -------------------------------------------------

type ChatRow = { id: number; role: "user" | "assistant"; content: string; created_at: number };
const HISTORY_TURNS = 6; // the last six messages, read from the database and never from the app
const KEEP_MESSAGES = 60;

app.get("/chat", async (c) => {
  const rows = await c.env.DB
    .prepare("SELECT id, role, content, created_at FROM ai_messages WHERE uid = ? ORDER BY id DESC LIMIT 40")
    .bind(c.get("uid"))
    .all<ChatRow>();
  return c.json({ messages: rows.results.reverse() });
});

app.delete("/chat", async (c) => {
  await c.env.DB.prepare("DELETE FROM ai_messages WHERE uid = ?").bind(c.get("uid")).run();
  return c.json({ ok: true });
});

app.post("/chat", async (c) => {
  const parsed = AiChat.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_input" }, 400);
  const uid = c.get("uid");

  if (await testInProgress(c)) return c.json({ error: "ai_paused_in_test" }, 409);
  const screened = await screenInput(c.env.DB, uid, parsed.data.message);
  if (!screened.ok) return c.json({ error: screened.error }, screened.error === "ai_blocked" ? 429 : 400);

  const style = await styleFor(c, parsed.data.profile);
  const recent = await c.env.DB
    .prepare("SELECT role, content FROM ai_messages WHERE uid = ? ORDER BY id DESC LIMIT ?")
    .bind(uid, HISTORY_TURNS)
    .all<{ role: string; content: string }>();
  const history = recent.results
    .reverse()
    .map((m) => `${m.role === "user" ? "Student" : "Helper"}: ${m.content.slice(0, 1200)}`)
    .join("\n");

  const result = await withQuota(c, () =>
    runGuarded(c.env, { system: systemFor(DOUBT_SYSTEM, style), question: screened.text, history }),
  );
  if (!result.ok) return c.json({ error: result.error }, result.status);

  await c.env.DB.batch([
    c.env.DB.prepare("INSERT INTO ai_messages (uid, role, content) VALUES (?, 'user', ?)").bind(uid, screened.text),
    c.env.DB.prepare("INSERT INTO ai_messages (uid, role, content) VALUES (?, 'assistant', ?)").bind(uid, result.value),
    c.env.DB
      .prepare(
        `DELETE FROM ai_messages WHERE uid = ?1 AND id <= COALESCE(
           (SELECT id FROM ai_messages WHERE uid = ?1 ORDER BY id DESC LIMIT 1 OFFSET ?2), 0)`,
      )
      .bind(uid, KEEP_MESSAGES),
  ]);
  return c.json({ reply: result.value, style, remaining: result.remaining });
});

// ---- doubts ----------------------------------------------------------------

type DoubtRow = { id: string; uid: string; batch_id: string | null; subject: string | null; question_text: string; ai_answer: string | null };

async function mayAnswerDoubt(c: Context<AppEnv>, doubt: DoubtRow): Promise<boolean> {
  const uid = c.get("uid");
  if (doubt.uid === uid || ADMIN_ROLES.includes(c.get("role"))) return true;
  if (!doubt.batch_id) return false;
  const assigned = await c.env.DB
    .prepare("SELECT 1 FROM batch_teachers WHERE teacher_uid = ? AND batch_id = ?")
    .bind(uid, doubt.batch_id)
    .first();
  return Boolean(assigned);
}

// An instant answer for a posted doubt: for the student while they wait for their
// teacher, and as a draft a teacher can edit. Stored once, then shown free.
app.post("/doubts/:id", async (c) => {
  const doubt = await c.env.DB
    .prepare("SELECT id, uid, batch_id, subject, question_text, ai_answer FROM doubts WHERE id = ?")
    .bind(c.req.param("id"))
    .first<DoubtRow>();
  if (!doubt || !(await mayAnswerDoubt(c, doubt))) return c.json({ error: "not_found" }, 404);

  const limits = limitsFor(c.env, staff(c));
  if (doubt.ai_answer) {
    return c.json({ answer: doubt.ai_answer, cached: true, remaining: await remainingToday(c.env.DB, c.get("uid"), limits.user) });
  }
  if (await testInProgress(c)) return c.json({ error: "ai_paused_in_test" }, 409);

  const screened = await screenInput(c.env.DB, doubt.uid, doubt.question_text, 2000);
  if (!screened.ok) return c.json({ error: screened.error }, screened.error === "ai_blocked" ? 429 : 400);

  const body = (await c.req.json().catch(() => null)) as { profile?: unknown } | null;
  const style = await styleFor(c, body?.profile);
  const result = await withQuota(c, () =>
    runGuarded(c.env, { system: systemFor(DOUBT_SYSTEM, style), question: screened.text, details: doubt.subject ? `Subject: ${doubt.subject}` : undefined }),
  );
  if (!result.ok) return c.json({ error: result.error }, result.status);

  await c.env.DB
    .prepare("UPDATE doubts SET ai_answer = ?, ai_answered_at = unixepoch() WHERE id = ? AND ai_answer IS NULL")
    .bind(result.value, doubt.id)
    .run();
  return c.json({ answer: result.value, cached: false, remaining: result.remaining });
});

// ---- test solutions ----------------------------------------------------------

type StoredQuestion = { id: string; prompt: string; options: string[]; answer: string };

// "Why is this the answer?" for one question, after the student has submitted.
// The explanation does not depend on who asks, so it is saved and shared:
// the first student pays the cost, everyone after gets it free. The cache is
// kept per language and exam style, so a NEET explanation is never reused as a
// board one.
app.post("/explain", async (c) => {
  const parsed = AiExplain.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_input" }, 400);
  const { testId, questionId, lang } = parsed.data;
  const uid = c.get("uid");

  const submitted = await c.env.DB
    .prepare("SELECT 1 FROM attempts WHERE test_id = ? AND uid = ? AND submitted_at IS NOT NULL")
    .bind(testId, uid)
    .first();
  if (!submitted) return c.json({ error: "not_found" }, 404);
  if (await testInProgress(c)) return c.json({ error: "ai_paused_in_test" }, 409);

  // The exam style comes from the test's own batch (NEET and JEE batches have their
  // own pattern); otherwise from the student's board. It is part of the cache key.
  const track = await c.env.DB
    .prepare("SELECT b.track FROM tests t LEFT JOIN batches b ON b.id = t.batch_id WHERE t.id = ?")
    .bind(testId)
    .first<{ track: string | null }>();
  const style = track?.track === "neet" || track?.track === "jee" ? defaultProfile({ goal: track.track }) : await styleFor(c, undefined);
  const cacheKey = `${lang}:${style}`;

  const limits = limitsFor(c.env, staff(c));
  const cached = await c.env.DB
    .prepare("SELECT text FROM ai_explanations WHERE test_id = ? AND question_id = ? AND lang = ?")
    .bind(testId, questionId, cacheKey)
    .first<{ text: string }>();
  if (cached) return c.json({ explanation: cached.text, cached: true, remaining: await remainingToday(c.env.DB, uid, limits.user) });

  const test = await c.env.DB
    .prepare("SELECT questions_json, kind FROM tests WHERE id = ?")
    .bind(testId)
    .first<{ questions_json: string; kind: string }>();
  const question = (JSON.parse(test?.questions_json ?? "[]") as StoredQuestion[]).find((q) => q.id === questionId);
  if (!test || !question) return c.json({ error: "not_found" }, 404);

  const text =
    `Write the explanation in ${lang === "bn" ? "Bengali" : "English"}.\n` +
    `${sanitizeUserText(question.prompt, 1500)}\nOptions:\n${question.options.map((o, i) => `${i + 1}. ${sanitizeUserText(o, 300)}`).join("\n")}\nCorrect option: ${sanitizeUserText(question.answer, 300)}`;
  const result = await withQuota(c, () => runGuarded(c.env, { system: systemFor(EXPLAIN_SYSTEM, style), question: text }));
  if (!result.ok) return c.json({ error: result.error }, result.status);

  await c.env.DB
    .prepare("INSERT OR IGNORE INTO ai_explanations (test_id, question_id, lang, text) VALUES (?, ?, ?, ?)")
    .bind(testId, questionId, cacheKey, result.value)
    .run();
  return c.json({ explanation: result.value, cached: false, remaining: result.remaining });
});

// ---- question generator (teachers and admins) ----------------------------------

// Drafts only: nothing is saved. The questions follow the chosen exam's own
// pattern, the teacher edits what they want, and the test stays a draft until a
// person publishes it.
app.post("/questions", async (c) => {
  if (!staff(c)) return c.json({ error: "forbidden" }, 403);
  const parsed = AiQuestions.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_input" }, 400);
  const { profile, subject, topic, count, difficulty, lang } = parsed.data;
  if (!EXAM_PROFILES[profile].mcq) return c.json({ error: "ai_profile_not_mcq" }, 400);

  const screened = await screenInput(c.env.DB, c.get("uid"), topic, 200);
  if (!screened.ok) return c.json({ error: screened.error }, screened.error === "ai_blocked" ? 429 : 400);

  const row = await c.env.DB.prepare("SELECT name_en FROM subjects WHERE id = ?").bind(subject).first<{ name_en: string }>();
  const ask = `Write ${count} ${difficulty} multiple-choice questions on this topic, in ${lang === "bn" ? "Bengali" : "English"}.`;
  const result = await withQuota(c, () =>
    runGuarded(c.env, {
      system: systemFor(QUESTIONS_SYSTEM, profile),
      question: `${ask}\nTopic: ${screened.text}`,
      details: `Subject: ${row?.name_en ?? subject}`,
      maxTokens: 3500,
    }),
  );
  if (!result.ok) return c.json({ error: result.error }, result.status);

  const { questions, dropped } = parseGeneratedQuestions(result.value, { subject, max: count, marks: EXAM_PROFILES[profile].marksPerMcq });
  if (questions.length === 0) {
    await refund(c.env.DB, c.get("uid"));
    return c.json({ error: "ai_no_questions" }, 502);
  }
  return c.json({ questions, dropped, profile, remaining: result.remaining });
});

export default app;
