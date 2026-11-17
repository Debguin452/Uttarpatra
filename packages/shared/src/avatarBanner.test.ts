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
