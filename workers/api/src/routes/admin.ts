import { Hono } from "hono";
import { PaymentReview } from "@coaching-app/shared/schema";
import { requireRole } from "../middleware/firebaseAuth";
import type { Env } from "../index";

const app = new Hono<{ Bindings: Env; Variables: { uid: string; role: string } }>();

app.use("*", requireRole("support", "super_admin"));

app.post("/payments/review", async (c) => {
  const parsed = PaymentReview.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "invalid_input" }, 400);
  const { paymentId, decision, note } = parsed.data;

  const payment = await c.env.DB
    .prepare("SELECT uid, batch_id, status FROM payments WHERE id = ?")
    .bind(paymentId)
    .first<{ uid: string; batch_id: string; status: string }>();
  if (!payment) return c.json({ error: "not_found" }, 404);
  if (payment.status !== "pending") return c.json({ error: "already_reviewed" }, 409);

  const batch = c.env.DB.batch([
    c.env.DB
      .prepare("UPDATE payments SET status = ?, reviewed_by = ?, reviewed_at = unixepoch() WHERE id = ?")
      .bind(decision, c.get("uid"), paymentId),
    ...(decision === "approved"
      ? [
          c.env.DB
            .prepare(
              "INSERT OR IGNORE INTO enrollments (uid, batch_id, granted_by) VALUES (?, ?, 'payment')",
            )
            .bind(payment.uid, payment.batch_id),
        ]
      : []),
    c.env.DB
      .prepare("INSERT INTO audit_log (actor_uid, action, target, meta_json) VALUES (?, ?, ?, ?)")
      .bind(c.get("uid"), `payment.${decision}`, paymentId, JSON.stringify({ note })),
  ]);
  await batch;

  return c.json({ ok: true });
});

app.get("/payments/pending", async (c) => {
  const rows = await c.env.DB
    .prepare(
      `SELECT p.id, p.uid, u.name, p.batch_id, p.amount_paise, p.utr, p.created_at
       FROM payments p JOIN users u ON u.uid = p.uid
       WHERE p.status = 'pending' ORDER BY p.created_at ASC LIMIT 50`,
    )
    .all();
  return c.json(rows.results);
});

export default app;
