export type Coupon = {
  discount_type: "percent" | "flat";
  /** For 'percent': a whole-number percentage (20 = 20%).
   *  For 'flat': rupees, not paise (matches the coupons table). */
  discount_value: number;
};

/**
 * Pure discount calculation used by POST /api/payments/manual-upi.
 * The caller is responsible for the coupon's validity (batch match,
 * usage cap, date window) via the SQL WHERE clause — this function only
 * does the arithmetic, which is why it's unit-testable without D1.
 */
export function applyCoupon(priceInPaise: number, coupon: Coupon | null): number {
  if (!coupon) return priceInPaise;

  const discounted =
    coupon.discount_type === "percent"
      ? Math.round(priceInPaise * (1 - coupon.discount_value / 100))
      : priceInPaise - coupon.discount_value * 100;

  return Math.max(0, discounted);
}
