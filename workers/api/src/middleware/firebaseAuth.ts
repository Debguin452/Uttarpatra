import type { MiddlewareHandler } from "hono";
import { jwtVerify, createRemoteJWKSet } from "jose";
import type { AppEnv } from "../index";

const JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
);

export function firebaseAuth(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    if (c.req.method === "OPTIONS") return next();
    const header = c.req.header("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return c.json({ error: "missing_token" }, 401);

    let uid: string;
    try {
      const { payload } = await jwtVerify(token, JWKS, {
        issuer: `https://securetoken.google.com/${c.env.FIREBASE_PROJECT_ID}`,
        audience: c.env.FIREBASE_PROJECT_ID,
      });
      if (!payload.sub) return c.json({ error: "invalid_token" }, 401);
      uid = payload.sub;
    } catch {
      return c.json({ error: "invalid_token" }, 401);
    }

    const row = await c.env.DB
      .prepare("SELECT role, status FROM users WHERE uid = ?")
      .bind(uid)
      .first<{ role: string; status: string }>();

    if (row?.status === "blocked") return c.json({ error: "account_blocked" }, 403);

    c.set("uid", uid);
    c.set("role", row?.role ?? "guest");
    await next();
  };
}

export function requireRegistered(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    if (c.req.method === "OPTIONS") return next();
    if (c.get("role") === "guest") return c.json({ error: "not_registered" }, 403);
    await next();
  };
}

export function requireRole(...roles: string[]): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    if (!roles.includes(c.get("role"))) return c.json({ error: "forbidden" }, 403);
    await next();
  };
}
