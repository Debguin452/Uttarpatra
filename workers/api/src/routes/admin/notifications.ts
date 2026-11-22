import { Hono } from "hono";
import { NotificationSend } from "@coaching-app/shared/schema";
import { execCtx, sendNotification } from "../../lib/notify";
import type { AppEnv } from "../../index";

const app = new Hono<AppEnv>();

// What admins have sent, newest first, with how many people it reached and how many opened it.
app.get("/", async (c) => {
  const rows = await c.env.DB
    .prepare(
      `SELECT n.id, n.kind, n.audience, n.audience_value, n.batch_id, b.title_en AS batch_title_en, n.title_bn, n.title_en,
              n.body_bn, n.body_en, n.recipient_count, n.created_at, s.name AS sender_name,
              (SELECT COUNT(*) FROM notification_reads r WHERE r.notification_id = n.id) AS read_count
       FROM notifications n
       LEFT JOIN batches b ON b.id = n.batch_id
       LEFT JOIN users s ON s.uid = n.sender_uid
       WHERE n.kind = 'announcement'
       ORDER BY n.created_at DESC LIMIT 100`,
    )
    .all();
  return c.json(rows.results);
});

app.post("/", async (c) => {
  const parsed = NotificationSend.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_input", issues: parsed.error.flatten() }, 400);
  const n = parsed.data;

  if (n.audience === "batch") {
    const batch = await c.env.DB.prepare("SELECT 1 FROM batches WHERE id = ?").bind(n.batchId).first();
    if (!batch) return c.json({ error: "batch_not_found" }, 400);
  }
  if (n.audience === "user") {
    const user = await c.env.DB.prepare("SELECT 1 FROM users WHERE uid = ?").bind(n.userId).first();
    if (!user) return c.json({ error: "not_found" }, 404);
  }

  const result = await sendNotification(c.env, execCtx(c), {
    senderUid: c.get("uid"),
    audience: n.audience,
    batchId: n.audience === "batch" ? n.batchId : null,
    value: n.audience === "class" ? n.studentClass : n.audience === "user" ? n.userId : null,
    text: { titleBn: n.titleBn, titleEn: n.titleEn, bodyBn: n.bodyBn, bodyEn: n.bodyEn },
  });
  return c.json({ ok: true, ...result }, 201);
});

app.delete("/:id", async (c) => {
  const result = await c.env.DB.prepare("DELETE FROM notifications WHERE id = ?").bind(c.req.param("id")).run();
  if (result.meta.changes === 0) return c.json({ error: "not_found" }, 404);
  return c.json({ ok: true });
});

export default app;
