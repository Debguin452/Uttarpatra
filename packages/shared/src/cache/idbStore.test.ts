import { describe, it, expect } from "vitest";
import { isFresh } from "./idbStore";

describe("isFresh", () => {
  it("is fresh when well within the TTL", () => {
    expect(isFresh({ value: null, storedAt: Date.now(), ttlMs: 60_000 })).toBe(true);
  });

  it("is stale once the TTL has elapsed", () => {
    expect(isFresh({ value: null, storedAt: Date.now() - 120_000, ttlMs: 60_000 })).toBe(false);
  });

  it("treats exactly-at-the-boundary as stale, not fresh", () => {
    const ttlMs = 60_000;
    expect(isFresh({ value: null, storedAt: Date.now() - ttlMs, ttlMs })).toBe(false);
  });

  it("is fresh one millisecond before the boundary", () => {
    const ttlMs = 60_000;
    expect(isFresh({ value: null, storedAt: Date.now() - ttlMs + 1, ttlMs })).toBe(true);
  });
});

describe("idbDelete", () => {
  it("resolves without throwing when IndexedDB is unavailable", async () => {
    const { idbDelete } = await import("./idbStore");
    await expect(idbDelete("missing-key")).resolves.toBeUndefined();
  });
});
