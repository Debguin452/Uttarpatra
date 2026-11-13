import { Hono } from "hono";
import { DoubtCreate } from "@coaching-app/shared/schema";
import type { AppEnv } from "../index";

const app = new Hono<AppEnv>();

app.get("/mine", async (c) => {
  const rows = await c.env.DB
    .prepare(
      `SELECT id, batch_id, subject, question_text, image_drive_id, status, answer_text, created_at
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

  const id = crypto.randomUUID();
  await c.env.DB
    .prepare(
      `INSERT INTO doubts (id, uid, batch_id, subject, question_text, image_drive_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, c.get("uid"), batchId ?? null, subject ?? null, questionText, imageDriveId ?? null)
    .run();

  return c.json({ ok: true, id });
});

export default app;
