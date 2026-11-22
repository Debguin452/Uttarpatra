import { Hono } from "hono";
import { DoubtAnswer } from "@coaching-app/shared/schema";
import { notifyDoubtAnswered } from "../../lib/doubtRouting";
import { execCtx } from "../../lib/notify";
import type { AppEnv } from "../../index";

const app = new Hono<AppEnv>();

// Admins see every doubt, whichever batch it was sent to, including older ones
// that were sent without a batch. Open ones first.
app.get("/", async (c) => {
  const status = c.req.query("status");
  const rows = await c.env.DB
    .prepare(
      `SELECT d.id, d.uid, u.name, d.batch_id, b.title_en AS batch_title_en, d.subject, d.question_text, d.image_drive_id,
              d.status, d.answer_text, d.ai_answer, d.created_at, a.name AS answered_by_name
       FROM doubts d
       JOIN users u ON u.uid = d.uid
       LEFT JOIN batches b ON b.id = d.batch_id
       LEFT JOIN users a ON a.uid = d.answered_by
       WHERE (?1 IS NULL OR d.status = ?1)
       ORDER BY (d.status = 'open') DESC, d.created_at DESC LIMIT 200`,
    )
    .bind(status === "open" || status === "answered" ? status : null)
    .all();
  return c.json(rows.results);
});

app.post("/:id/answer", async (c) => {
  const parsed = DoubtAnswer.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_input" }, 400);

  const doubt = await c.env.DB.prepare("SELECT uid FROM doubts WHERE id = ?").bind(c.req.param("id")).first<{ uid: string }>();
  if (!doubt) return c.json({ error: "not_found" }, 404);
  await c.env.DB
    .prepare("UPDATE doubts SET status = 'answered', answered_by = ?, answer_text = ? WHERE id = ?")
    .bind(c.get("uid"), parsed.data.answerText, c.req.param("id"))
    .run();
  await notifyDoubtAnswered(c.env, execCtx(c), doubt.uid);
  return c.json({ ok: true });
});

export default app;
