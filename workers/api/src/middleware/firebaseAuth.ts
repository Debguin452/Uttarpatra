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
    let email: string | null;
    try {
      const { payload } = await jwtVerify(token, JWKS, {
        issuer: `https://securetoken.google.com/${c.env.FIREBASE_PROJECT_ID}`,
        audience: c.env.FIREBASE_PROJECT_ID,
      });
      if (!payload.sub) return c.json({ error: "invalid_token" }, 401);
      uid = payload.sub;
      email = typeof payload.email === "string" ? payload.email.toLowerCase() : null;
    } catch {
      return c.json({ error: "invalid_token" }, 401);
    }

    const row = await c.env.DB
      .prepare("SELECT role, status, is_teacher FROM users WHERE uid = ?")
      .bind(uid)
      .first<{ role: string; status: string; is_teacher: number }>();

    if (row?.status === "blocked") return c.json({ error: "account_blocked" }, 403);

    c.set("uid", uid);
    c.set("email", email);
    c.set("role", row?.role ?? "guest");
    c.set("isTeacher", Boolean(row?.is_teacher));
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

// Grants teacher-area access to real teachers, and to support/super_admin
// accounts that have been given the is_teacher add-on (see admin/users.ts
// POST /users/:uid/teacher-access).
export function requireTeacherAccess(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const role = c.get("role");
    const isAdmin = role === "support" || role === "super_admin";
    if (role !== "teacher" && !(isAdmin && c.get("isTeacher"))) {
      return c.json({ error: "forbidden" }, 403);
    }
    await next();
  };
}
