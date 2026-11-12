import { Hono } from "hono";
import { ulid } from "ulidx";
import { ManualPaymentSubmit } from "@coaching-app/shared/schema";
import { applyCoupon } from "@coaching-app/shared/pricing";
import { verifyTurnstile } from "../lib/turnstile";
import type { Env } from "../index";

const app = new Hono<{ Bindings: Env; Variables: { uid: string; role: string } }>();

// Student submits a UTR + screenshot; nothing is granted yet. This keeps
// the trust boundary in one place — only an admin action in routes/admin.ts
// ever writes to `enrollments`.
app.post("/manual-upi", async (c) => {
  const turnstileOk = await verifyTurnstile(c.req.header("cf-turnstile-token"), c.env.TURNSTILE_SECRET);
  if (!turnstileOk) return c.json({ error: "turnstile_failed" }, 400);

  const parsed = ManualPaymentSubmit.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "invalid_input", issues: parsed.error.flatten() }, 400);
  const { batchId, utr, couponCode, screenshotBase64 } = parsed.data;

  const batch = await c.env.DB
    .prepare("SELECT price_paise, status FROM batches WHERE id = ?")
    .bind(batchId)
    .first<{ price_paise: number; status: string }>();
  if (!batch || batch.status !== "published") return c.json({ error: "batch_not_found" }, 404);

  let amount = batch.price_paise;
  if (couponCode) {
    const coupon = await c.env.DB
      .prepare(
        `SELECT discount_type, discount_value FROM coupons WHERE code = ? AND (batch_id IS NULL OR batch_id = ?)
         AND (max_uses IS NULL OR used_count < max_uses)
         AND (valid_until IS NULL OR valid_until > unixepoch())`,
      )
      .bind(couponCode, batchId)
      .first<{ discount_type: "percent" | "flat"; discount_value: number }>();
    amount = applyCoupon(amount, coupon ?? null);
  }

  const id = ulid();
  try {
    await c.env.DB
      .prepare(
        `INSERT INTO payments (id, uid, batch_id, method, amount_paise, coupon_code, utr, screenshot_b64, status)
         VALUES (?, ?, ?, 'manual_upi', ?, ?, ?, ?, 'pending')`,
      )
      .bind(id, c.get("uid"), batchId, amount, couponCode ?? null, utr, screenshotBase64)
      .run();
  } catch (e) {
    // The UNIQUE index on utr is the actual guard against a reused
    // screenshot being submitted for two different accounts.
    return c.json({ error: "utr_already_used" }, 409);
  }

  return c.json({ paymentId: id, amountPaise: amount, status: "pending" });
});

app.get("/mine", async (c) => {
  const rows = await c.env.DB
    .prepare("SELECT id, batch_id, amount_paise, status, created_at FROM payments WHERE uid = ? ORDER BY created_at DESC")
    .bind(c.get("uid"))
    .all();
  return c.json(rows.results);
});

export default app;
