import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../index";

// Per-user rate limit only. There is no device lock: an account can be used
// from any phone or browser, on as many devices as the student likes.
export function guard(opts: { limit: number; windowSec: number }): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    if (c.req.method === "OPTIONS") return next();

    const stub = c.env.SESSIONS.get(c.env.SESSIONS.idFromName(c.get("uid")));
    const res = await stub.fetch("https://do/guard", {
      method: "POST",
      body: JSON.stringify({ limit: opts.limit, windowSec: opts.windowSec }),
    });
    if (res.status === 429) return c.json({ error: "rate_limited" }, 429);
    if (!res.ok) return c.json({ error: "guard_failed" }, 500);
    await next();
  };
}
