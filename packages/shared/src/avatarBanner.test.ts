import { describe, expect, it } from "vitest";
import { AvatarUpdate, BatchUpsert } from "./schema";

describe("AvatarUpdate", () => {
  it("accepts a preset, a small image, and null (remove)", () => {
    expect(AvatarUpdate.safeParse({ photo: "preset:owl" }).success).toBe(true);
    expect(AvatarUpdate.safeParse({ photo: "data:image/jpeg;base64,/9j/4AAQSkZJRg==" }).success).toBe(true);
    expect(AvatarUpdate.safeParse({ photo: null }).success).toBe(true);
  });

  it("rejects links, scripts, odd types and oversized images", () => {
    for (const photo of [
      "https://example.com/a.png",
      "javascript:alert(1)",
      "data:text/html;base64,PHNjcmlwdD4=",
      "data:image/svg+xml;base64,PHN2Zz4=",
      "preset:Bad Id",
      `data:image/jpeg;base64,${"A".repeat(40_000)}`,
    ]) {
      expect(AvatarUpdate.safeParse({ photo }).success).toBe(false);
    }
  });
});

describe("BatchUpsert banner", () => {
  const base = { id: "neet-2027", titleBn: "ক", titleEn: "A", track: "neet", kind: "free", pricePaise: 0, status: "draft" };

  it("allows no banner or an https banner", () => {
    expect(BatchUpsert.safeParse(base).success).toBe(true);
    expect(BatchUpsert.safeParse({ ...base, bannerUrl: "https://example.com/b.jpg" }).success).toBe(true);
  });

  it("rejects http and non-link banners", () => {
    expect(BatchUpsert.safeParse({ ...base, bannerUrl: "http://example.com/b.jpg" }).success).toBe(false);
    expect(BatchUpsert.safeParse({ ...base, bannerUrl: "not a link" }).success).toBe(false);
  });
});

import { BannerUpsert, TeacherProfileUpdate } from "./schema";

describe("BannerUpsert targets", () => {
  const base = { imageUrl: "https://example.com/b.jpg", titleBn: "ক", titleEn: "A" };

  it("accepts each kind of target", () => {
    for (const body of [
      base,
      { ...base, targetType: "batch", targetId: "neet-2027" },
      { ...base, targetType: "test", targetId: "t1" },
      { ...base, targetType: "lecture", targetId: "l1" },
      { ...base, targetType: "material", targetId: "n1" },
      { ...base, targetType: "link", linkUrl: "https://example.com" },
      { ...base, batchId: "neet-2027" },
    ]) {
      expect(BannerUpsert.safeParse(body).success).toBe(true);
    }
  });

  it("rejects a target with nothing chosen", () => {
    expect(BannerUpsert.safeParse({ ...base, targetType: "test" }).success).toBe(false);
    expect(BannerUpsert.safeParse({ ...base, targetType: "link" }).success).toBe(false);
    expect(BannerUpsert.safeParse({ ...base, targetType: "course", targetId: "x" }).success).toBe(false);
  });
});

describe("TeacherProfileUpdate", () => {
  it("only takes the public profile fields", () => {
    const parsed = TeacherProfileUpdate.safeParse({
      qualification: "M.Sc. Chemistry",
      experienceYears: 6,
      phone: "9876543210",
      bio: "I teach organic chemistry for NEET and boards, with a lot of practice.",
      subjects: ["chemistry"],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect("subjects" in parsed.data).toBe(false);
  });
});
