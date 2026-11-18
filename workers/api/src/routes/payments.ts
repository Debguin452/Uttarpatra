import { Hono } from "hono";
import { ulid } from "ulidx";
import { ManualPaymentSubmit } from "@coaching-app/shared/schema";
import { applyCoupon } from "@coaching-app/shared/pricing";
import { verifyTurnstile } from "../lib/turnstile";
import type { AppEnv } from "../index";

const app = new Hono<AppEnv>();

type Coupon = { discount_type: "percent" | "flat"; discount_value: number };

async function findCoupon(db: D1Database, code: string, batchId: string): Promise<Coupon | null> {
  return db
    .prepare(
      `SELECT discount_type, discount_value FROM coupons WHERE code = ? AND (batch_id IS NULL OR batch_id = ?)
       AND (max_uses IS NULL OR used_count < max_uses)
       AND (valid_from IS NULL OR valid_from <= unixepoch())
       AND (valid_until IS NULL OR valid_until > unixepoch())`,
    )
    .bind(code, batchId)
    .first<Coupon>();
}

app.get("/quote", async (c) => {
  const batchId = c.req.query("batchId") ?? "";
  const code = c.req.query("coupon") ?? "";
  const batch = await c.env.DB
    .prepare("SELECT price_paise FROM batches WHERE id = ? AND status = 'published' AND kind = 'paid'")
    .bind(batchId)
    .first<{ price_paise: number }>();
  if (!batch) return c.json({ error: "batch_not_found" }, 404);
  if (!code) return c.json({ amountPaise: batch.price_paise, couponApplied: false });
  const coupon = await findCoupon(c.env.DB, code, batchId);
  if (!coupon) return c.json({ error: "coupon_invalid" }, 400);
  return c.json({ amountPaise: applyCoupon(batch.price_paise, coupon), couponApplied: true });
});

app.post("/manual-upi", async (c) => {
  const check = await verifyTurnstile(c.req.header("cf-turnstile-token"), c.env.TURNSTILE_SECRET);
  if (!check.ok) return c.json({ error: "turnstile_failed", reason: check.codes }, 400);

  const parsed = ManualPaymentSubmit.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_input", issues: parsed.error.flatten() }, 400);
  const { batchId, utr, couponCode, screenshotBase64 } = parsed.data;
  const uid = c.get("uid");

  const batch = await c.env.DB
    .prepare("SELECT price_paise, kind, status FROM batches WHERE id = ?")
    .bind(batchId)
    .first<{ price_paise: number; kind: string; status: string }>();
  if (!batch || batch.status !== "published") return c.json({ error: "batch_not_found" }, 404);
  if (batch.kind !== "paid") return c.json({ error: "batch_is_free" }, 400);

  const existing = await c.env.DB
    .prepare(
      `SELECT
         EXISTS(SELECT 1 FROM enrollments WHERE uid = ?1 AND batch_id = ?2 AND (expires_at IS NULL OR expires_at > unixepoch())) AS enrolled,
         EXISTS(SELECT 1 FROM payments WHERE uid = ?1 AND batch_id = ?2 AND status = 'pending') AS pending`,
    )
    .bind(uid, batchId)
    .first<{ enrolled: number; pending: number }>();
  if (existing?.enrolled) return c.json({ error: "already_enrolled" }, 409);
  if (existing?.pending) return c.json({ error: "payment_pending" }, 409);

  let amount = batch.price_paise;
  if (couponCode) {
    const coupon = await findCoupon(c.env.DB, couponCode, batchId);
    if (!coupon) return c.json({ error: "coupon_invalid" }, 400);
    amount = applyCoupon(amount, coupon);
  }

  const id = ulid();
  try {
    await c.env.DB
      .prepare(
        `INSERT INTO payments (id, uid, batch_id, method, amount_paise, coupon_code, utr, screenshot_b64, status)
         VALUES (?, ?, ?, 'manual_upi', ?, ?, ?, ?, 'pending')`,
      )
      .bind(id, uid, batchId, amount, couponCode ?? null, utr.toUpperCase(), screenshotBase64)
      .run();
  } catch {
    return c.json({ error: "utr_already_used" }, 409);
  }

  return c.json({ paymentId: id, amountPaise: amount, status: "pending" });
});

app.get("/mine", async (c) => {
  const rows = await c.env.DB
    .prepare(
      "SELECT id, batch_id, amount_paise, status, created_at FROM payments WHERE uid = ? ORDER BY created_at DESC LIMIT 50",
    )
    .bind(c.get("uid"))
    .all();
  return c.json(rows.results);
});

export default app;
