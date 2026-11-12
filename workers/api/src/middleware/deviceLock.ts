import type { MiddlewareHandler } from "hono";
import type { Env } from "../index";

/**
 * A DO per user holds the single bound device id. Using a DO rather than
 * D1 here because the check-and-set has to be atomic: two logins racing
 * on the same account must not both succeed.
 */
export function deviceLock(): MiddlewareHandler<{ Bindings: Env; Variables: { uid: string } }> {
  return async (c, next) => {
    const deviceId = c.req.header("x-device-id");
    if (!deviceId) return c.json({ error: "missing_device_id" }, 400);

    const stub = c.env.SESSIONS.get(c.env.SESSIONS.idFromName(`device:${c.get("uid")}`));
    const res = await stub.fetch("https://do/device-check", {
      method: "POST",
      body: JSON.stringify({ deviceId }),
    });
    if (res.status === 409) {
      return c.json({ error: "device_mismatch", message: "Signed in on another device" }, 409);
    }
    await next();
  };
}
