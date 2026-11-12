import { Hono } from "hono";
import { PaymentReview } from "@coaching-app/shared/schema";
import { requireRole } from "../middleware/firebaseAuth";
import type { AppEnv } from "../index";

const app = new Hono<AppEnv>();

app.use("*", requireRole("support", "super_admin"));

app.get("/payments/pending", async (c) => {
  const rows = await c.env.DB
    .prepare(
      `SELECT p.id, p.uid, u.name, p.batch_id, p.amount_paise, p.utr, p.coupon_code, p.created_at
       FROM payments p JOIN users u ON u.uid = p.uid
       WHERE p.status = 'pending' ORDER BY p.created_at ASC LIMIT 50`,
    )
    .all();
  return c.json(rows.results);
});

app.get("/payments/:id/screenshot", async (c) => {
  const row = await c.env.DB
    .prepare("SELECT screenshot_b64 FROM payments WHERE id = ?")
    .bind(c.req.param("id"))
    .first<{ screenshot_b64: string | null }>();
  if (!row) return c.json({ error: "not_found" }, 404);
  return c.json({ screenshotBase64: row.screenshot_b64 });
});

app.post("/payments/review", async (c) => {
  const parsed = PaymentReview.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_input" }, 400);
  const { paymentId, decision, note } = parsed.data;

  const payment = await c.env.DB
    .prepare("SELECT uid, batch_id, status, coupon_code FROM payments WHERE id = ?")
    .bind(paymentId)
    .first<{ uid: string; batch_id: string; status: string; coupon_code: string | null }>();
  if (!payment) return c.json({ error: "not_found" }, 404);
  if (payment.status !== "pending") return c.json({ error: "already_reviewed" }, 409);

  const statements = [
    c.env.DB
      .prepare("UPDATE payments SET status = ?, reviewed_by = ?, reviewed_at = unixepoch() WHERE id = ? AND status = 'pending'")
      .bind(decision, c.get("uid"), paymentId),
    c.env.DB
      .prepare("INSERT INTO audit_log (actor_uid, action, target, meta_json) VALUES (?, ?, ?, ?)")
      .bind(c.get("uid"), `payment.${decision}`, paymentId, JSON.stringify({ note })),
  ];

  if (decision === "approved") {
    statements.push(
      c.env.DB
        .prepare("INSERT OR IGNORE INTO enrollments (uid, batch_id, granted_by) VALUES (?, ?, 'payment')")
        .bind(payment.uid, payment.batch_id),
    );
    if (payment.coupon_code) {
      statements.push(
        c.env.DB.prepare("UPDATE coupons SET used_count = used_count + 1 WHERE code = ?").bind(payment.coupon_code),
      );
    }
  }

  await c.env.DB.batch(statements);
  return c.json({ ok: true });
});

app.post("/users/:uid/reset-device", async (c) => {
  const uid = c.req.param("uid");
  const stub = c.env.SESSIONS.get(c.env.SESSIONS.idFromName(uid));
  await stub.fetch("https://do/reset-device", { method: "POST" });
  await c.env.DB
    .prepare("INSERT INTO audit_log (actor_uid, action, target) VALUES (?, 'user.reset_device', ?)")
    .bind(c.get("uid"), uid)
    .run();
  return c.json({ ok: true });
});

app.post("/users/:uid/status", requireRole("super_admin"), async (c) => {
  const body = (await c.req.json().catch(() => null)) as { status?: string } | null;
  if (body?.status !== "active" && body?.status !== "blocked") return c.json({ error: "invalid_input" }, 400);
  const uid = c.req.param("uid");
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE users SET status = ?, updated_at = unixepoch() WHERE uid = ?").bind(body.status, uid),
    c.env.DB
      .prepare("INSERT INTO audit_log (actor_uid, action, target) VALUES (?, ?, ?)")
      .bind(c.get("uid"), `user.${body.status}`, uid),
  ]);
  return c.json({ ok: true });
});

export default app;
