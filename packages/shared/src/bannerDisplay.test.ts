import { describe, expect, it } from "vitest";
import { BannerUpsert, NotificationSend } from "./schema";
import { discountPercent, feeLabel, isScheduledNow } from "./bannerDisplay";

describe("isScheduledNow", () => {
  it("shows when no schedule is set, inside the window, and hides outside it", () => {
    expect(isScheduledNow({}, 100)).toBe(true);
    expect(isScheduledNow({ starts_at: 50, ends_at: 150 }, 100)).toBe(true);
    expect(isScheduledNow({ starts_at: 200 }, 100)).toBe(false);
    expect(isScheduledNow({ ends_at: 100 }, 100)).toBe(false);
    expect(isScheduledNow({ ends_at: 101 }, 100)).toBe(true);
  });
});

describe("fee display", () => {
  it("works out percent off and ignores fake discounts", () => {
    expect(discountPercent(79900, 99900)).toBe(20);
    expect(discountPercent(99900, 99900)).toBeNull();
    expect(discountPercent(120000, 99900)).toBeNull();
    expect(discountPercent(100, null)).toBeNull();
  });
  it("shows free batches as free and paid ones with the old price struck through", () => {
    expect(feeLabel(0, null, "free")).toMatchObject({ free: true });
    expect(feeLabel(79900, 99900, "paid")).toMatchObject({ free: false, price: 79900, mrp: 99900, off: 20 });
    expect(feeLabel(79900, null, "paid")).toMatchObject({ mrp: null, off: null });
  });
});

describe("BannerUpsert kinds", () => {
  const base = { titleBn: "ক", titleEn: "A" };
  it("a launch banner needs an image and a destination", () => {
    expect(BannerUpsert.safeParse({ ...base, kind: "launch", imageUrl: "", batchId: "b1" }).success).toBe(false);
    expect(BannerUpsert.safeParse({ ...base, kind: "launch", imageUrl: "https://x.y/i.jpg", batchId: "b1" }).success).toBe(true);
    expect(BannerUpsert.safeParse({ ...base, kind: "launch", imageUrl: "https://x.y/i.jpg", targetType: "link" }).success).toBe(false);
  });
  it("a community banner needs no image but needs something to say", () => {
    expect(BannerUpsert.safeParse({ ...base, kind: "community", imageUrl: "" }).success).toBe(false);
    expect(BannerUpsert.safeParse({ ...base, kind: "community", imageUrl: "", descriptionBn: "নিয়ম" }).success).toBe(true);
    expect(BannerUpsert.safeParse({ ...base, kind: "community", imageUrl: "", phone: "+91 98765 43210" }).success).toBe(true);
  });
  it("only https and tel links are allowed on contact buttons", () => {
    const button = (url: string) => ({ ...base, kind: "community", imageUrl: "", buttons: [{ labelBn: "ক", labelEn: "WhatsApp", url }] });
    expect(BannerUpsert.safeParse(button("https://wa.me/919876543210")).success).toBe(true);
    expect(BannerUpsert.safeParse(button("tel:+919876543210")).success).toBe(true);
    expect(BannerUpsert.safeParse(button("javascript:alert(1)")).success).toBe(false);
    expect(BannerUpsert.safeParse(button("http://insecure.example")).success).toBe(false);
  });
  it("allows at most three buttons and a sensible schedule", () => {
    const b = { labelBn: "ক", labelEn: "A", url: "https://t.me/x" };
    expect(BannerUpsert.safeParse({ ...base, kind: "community", imageUrl: "", buttons: [b, b, b, b] }).success).toBe(false);
    expect(BannerUpsert.safeParse({ ...base, kind: "community", imageUrl: "", phone: "+919876543210", startsAt: 200, endsAt: 100 }).success).toBe(false);
  });
});

describe("NotificationSend", () => {
  const text = { titleBn: "ক", titleEn: "A" };
  it("asks for the target each audience needs", () => {
    expect(NotificationSend.safeParse({ audience: "all", ...text }).success).toBe(true);
    expect(NotificationSend.safeParse({ audience: "teachers", ...text }).success).toBe(true);
    expect(NotificationSend.safeParse({ audience: "batch", ...text }).success).toBe(false);
    expect(NotificationSend.safeParse({ audience: "batch", batchId: "b1", ...text }).success).toBe(true);
    expect(NotificationSend.safeParse({ audience: "class", ...text }).success).toBe(false);
    expect(NotificationSend.safeParse({ audience: "user", userId: "u1", ...text }).success).toBe(true);
  });
});
