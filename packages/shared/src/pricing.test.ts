import { describe, it, expect } from "vitest";
import { applyCoupon } from "./pricing";

describe("applyCoupon", () => {
  it("returns the original price when there is no coupon", () => {
    expect(applyCoupon(100_00, null)).toBe(100_00);
  });

  it("applies a percent discount", () => {
    const coupon = { discount_type: "percent" as const, discount_value: 20 };
    expect(applyCoupon(100_00, coupon)).toBe(80_00);
  });

  it("rounds a percent discount to the nearest paisa", () => {
    const coupon = { discount_type: "percent" as const, discount_value: 33 };
    // 999 * 0.67 = 669.33 -> rounds to 669
    expect(applyCoupon(999, coupon)).toBe(669);
  });

  it("applies a flat discount, given in rupees", () => {
    const coupon = { discount_type: "flat" as const, discount_value: 50 };
    expect(applyCoupon(200_00, coupon)).toBe(150_00);
  });

  it("never lets a flat discount push the price below zero", () => {
    const coupon = { discount_type: "flat" as const, discount_value: 500 };
    expect(applyCoupon(100_00, coupon)).toBe(0);
  });

  it("never lets a 100%+ percent discount go negative", () => {
    const coupon = { discount_type: "percent" as const, discount_value: 150 };
    expect(applyCoupon(100_00, coupon)).toBe(0);
  });
});
