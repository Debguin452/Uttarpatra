import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { guard } from "./middleware/guard";
import { SessionGuard } from "./do/SessionGuard";
import type { AppEnv } from "./index";

function objectState() {
  const writes: string[] = [];
  const storage = {
    get: async () => undefined,
    put: async (key: string) => void writes.push(key),
    delete: async () => undefined,
  };
  return { state: { storage } as unknown as DurableObjectState, writes };
}

function buildApp(limit: number) {
  const { state, writes } = objectState();
  const instance = new SessionGuard(state);
  const env = {
    SESSIONS: {
      idFromName: (name: string) => name,
      get: () => ({ fetch: (url: string, init: RequestInit) => instance.fetch(new Request(url, init)) }),
    },
  };
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("uid", "student-1");
    await next();
  });
  app.use("*", guard({ limit, windowSec: 60 }));
  app.get("/ping", (c) => c.json({ ok: true }));
  return { request: (headers: Record<string, string> = {}) => app.request("/ping", { headers }, env), writes };
}

describe("one-device lock is off", () => {
  it("lets a request through with no device header at all", async () => {
    const { request } = buildApp(100);
    expect((await request()).status).toBe(200);
  });

  it("lets the same account in from any number of different devices", async () => {
    const { request } = buildApp(100);
    for (const device of ["a".repeat(20), "b".repeat(20), "c".repeat(20), "short"]) {
      expect((await request({ "x-device-id": device })).status).toBe(200);
    }
  });

  it("never stores a device binding", async () => {
    const { request, writes } = buildApp(100);
    await request({ "x-device-id": "d".repeat(24) });
    await request({ "x-device-id": "e".repeat(24) });
    expect(writes).toEqual([]);
  });

  it("never answers with a device error", async () => {
    const { request } = buildApp(100);
    await request({ "x-device-id": "first-device-aaaaaaaa" });
    const res = await request({ "x-device-id": "second-device-bbbbbbb" });
    expect(await res.json()).not.toHaveProperty("error");
  });
});

describe("rate limit still works", () => {
  it("blocks the request after the limit, whatever the device", async () => {
    const { request } = buildApp(3);
    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) statuses.push((await request({ "x-device-id": `device-${i}-padding-padding` })).status);
    expect(statuses).toEqual([200, 200, 200, 429, 429]);
  });
});
