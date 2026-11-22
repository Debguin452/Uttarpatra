import { Hono } from "hono";
import { DoubtCreate } from "@coaching-app/shared/schema";
import type { AppEnv } from "../index";
import { canOpenBatch } from "../lib/batchAccess";
import { notifyNewDoubt } from "../lib/doubtRouting";
import { execCtx } from "../lib/notify";

const app = new Hono<AppEnv>();

app.get("/mine", async (c) => {
  const rows = await c.env.DB
    .prepare(
      `SELECT id, batch_id, subject, question_text, image_drive_id, status, answer_text, ai_answer, created_at
       FROM doubts WHERE uid = ? ORDER BY created_at DESC LIMIT 100`,
    )
    .bind(c.get("uid"))
    .all();
  return c.json(rows.results);
});

app.post("/", async (c) => {
  const parsed = DoubtCreate.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_input", issues: parsed.error.flatten() }, 400);
  const { batchId, subject, questionText, imageDriveId } = parsed.data;

  // A doubt always goes to a batch: that decides which teachers get it. The student
  // can only pick a batch they can actually open (enrolled, or a free one).
  const access = await canOpenBatch(c.env.DB, c.get("uid"), batchId);
  if (access === "not_found") return c.json({ error: "batch_not_found" }, 400);
  if (access === "not_enrolled") return c.json({ error: "not_enrolled" }, 403);

  const id = crypto.randomUUID();
  await c.env.DB
    .prepare(
      `INSERT INTO doubts (id, uid, batch_id, subject, question_text, image_drive_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, c.get("uid"), batchId, subject ?? null, questionText, imageDriveId ?? null)
    .run();

  const student = await c.env.DB.prepare("SELECT name FROM users WHERE uid = ?").bind(c.get("uid")).first<{ name: string }>();
  await notifyNewDoubt(c.env, execCtx(c), {
    batchId,
    subject: subject ?? null,
    question: questionText,
    studentName: student?.name ?? "",
  });

  return c.json({ ok: true, id });
});

export default app;
