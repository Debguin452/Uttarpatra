import type { MiddlewareHandler } from "hono";
import type { Env } from "../index";

/**
 * Fixed-window counter inside a Durable Object named after the uid.
 * KV can't do atomic increments safely across concurrent requests; a DO
 * can, and DOs have their own 100k req/day budget separate from
 * Workers', so this doesn't eat into the main request quota's logic
 * (it does still cost one Worker invocation per call, counted once).
 */
export function rateLimit(opts: { limit: number; windowSec: number }): MiddlewareHandler<{
  Bindings: Env;
  Variables: { uid: string };
}> {
  return async (c, next) => {
    const uid = c.get("uid");
    const stub = c.env.SESSIONS.get(c.env.SESSIONS.idFromName(`rl:${uid}`));
    const res = await stub.fetch("https://do/rate-limit", {
      method: "POST",
      body: JSON.stringify({ limit: opts.limit, windowSec: opts.windowSec }),
    });
    if (res.status === 429) return c.json({ error: "rate_limited" }, 429);
    await next();
  };
}
