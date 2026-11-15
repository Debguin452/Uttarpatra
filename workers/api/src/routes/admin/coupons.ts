import { Hono } from "hono";
import { CouponUpsert } from "@coaching-app/shared/schema";
import type { AppEnv } from "../../index";

const app = new Hono<AppEnv>();

app.get("/", async (c) => {
  const rows = await c.env.DB
    .prepare(
      `SELECT c.code, c.discount_type, c.discount_value, c.max_uses, c.used_count,
              c.valid_from, c.valid_until, c.batch_id, b.title_en AS batch_title_en
       FROM coupons c LEFT JOIN batches b ON b.id = c.batch_id
       ORDER BY c.code`,
    )
    .all();
  return c.json(rows.results);
});

app.post("/", async (c) => {
  const parsed = CouponUpsert.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_input", issues: parsed.error.flatten() }, 400);
  const { code, discountType, discountValue, maxUses, validFrom, validUntil, batchId } = parsed.data;

  const existing = await c.env.DB.prepare("SELECT code FROM coupons WHERE code = ?").bind(code).first();
  if (existing) return c.json({ error: "coupon_exists" }, 409);

  await c.env.DB
    .prepare(
      `INSERT INTO coupons (code, discount_type, discount_value, max_uses, valid_from, valid_until, batch_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(code, discountType, discountValue, maxUses ?? null, validFrom ?? null, validUntil ?? null, batchId ?? null)
    .run();

  return c.json({ ok: true, code });
});

app.put("/:code", async (c) => {
  const parsed = CouponUpsert.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_input", issues: parsed.error.flatten() }, 400);
  const { discountType, discountValue, maxUses, validFrom, validUntil, batchId } = parsed.data;

  const result = await c.env.DB
    .prepare(
      `UPDATE coupons SET discount_type = ?, discount_value = ?, max_uses = ?, valid_from = ?, valid_until = ?, batch_id = ?
       WHERE code = ?`,
    )
    .bind(discountType, discountValue, maxUses ?? null, validFrom ?? null, validUntil ?? null, batchId ?? null, c.req.param("code").toUpperCase())
    .run();
  if (result.meta.changes === 0) return c.json({ error: "not_found" }, 404);
  return c.json({ ok: true });
});

app.delete("/:code", async (c) => {
  const result = await c.env.DB.prepare("DELETE FROM coupons WHERE code = ?").bind(c.req.param("code").toUpperCase()).run();
  if (result.meta.changes === 0) return c.json({ error: "not_found" }, 404);
  return c.json({ ok: true });
});

export default app;
