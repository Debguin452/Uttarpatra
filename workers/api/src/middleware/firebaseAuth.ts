import type { MiddlewareHandler } from "hono";
import { importX509, jwtVerify, createRemoteJWKSet } from "jose";
import type { Env } from "../index";

// Google rotates these keys; jose's remote JWKS set caches them per
// isolate, so this stays a cache hit (no extra subrequest, no CPU
// penalty) for the lifetime of the Worker instance.
const JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
);

export function firebaseAuth(): MiddlewareHandler<{ Bindings: Env; Variables: { uid: string; role: string } }> {
  return async (c, next) => {
    const authHeader = c.req.header("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return c.json({ error: "missing_token" }, 401);

    try {
      const { payload } = await jwtVerify(token, JWKS, {
        issuer: `https://securetoken.google.com/${c.env.FIREBASE_PROJECT_ID}`,
        audience: c.env.FIREBASE_PROJECT_ID,
      });

      // We check status against D1 (not the token claim alone) because a
      // block action must take effect immediately, not only after the
      // student's token naturally refreshes.
      const row = await c.env.DB
        .prepare("SELECT role, status FROM users WHERE uid = ?")
        .bind(payload.sub)
        .first<{ role: string; status: string }>();

      if (!row || row.status === "blocked") {
        return c.json({ error: "account_blocked" }, 403);
      }

      c.set("uid", payload.sub as string);
      c.set("role", row.role);
      await next();
    } catch {
      return c.json({ error: "invalid_token" }, 401);
    }
  };
}

export function requireRole(...roles: string[]): MiddlewareHandler<{ Variables: { role: string } }> {
  return async (c, next) => {
    if (!roles.includes(c.get("role"))) return c.json({ error: "forbidden" }, 403);
    await next();
  };
}
