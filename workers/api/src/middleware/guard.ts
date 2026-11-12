import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../index";

export function guard(opts: { limit: number; windowSec: number }): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    if (c.req.method === "OPTIONS") return next();
    const deviceId = c.req.header("x-device-id") ?? "";
    if (deviceId.length < 16) return c.json({ error: "missing_device_id" }, 400);

    const stub = c.env.SESSIONS.get(c.env.SESSIONS.idFromName(c.get("uid")));
    const res = await stub.fetch("https://do/guard", {
      method: "POST",
      body: JSON.stringify({ deviceId, limit: opts.limit, windowSec: opts.windowSec }),
    });
    if (res.status === 429) return c.json({ error: "rate_limited" }, 429);
    if (res.status === 409) return c.json({ error: "device_mismatch" }, 409);
    if (!res.ok) return c.json({ error: "guard_failed" }, 500);
    await next();
  };
}
