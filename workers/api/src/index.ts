import { Hono } from "hono";
import { cors } from "hono/cors";
import { firebaseAuth } from "./middleware/firebaseAuth";
import { deviceLock } from "./middleware/deviceLock";
import { rateLimit } from "./middleware/rateLimit";
import { edgeCache } from "./middleware/edgeCache";
import batches from "./routes/batches";
import payments from "./routes/payments";
import attempts from "./routes/attempts";
import admin from "./routes/admin";

export type Env = {
  DB: D1Database;
  SESSIONS: DurableObjectNamespace; // DeviceLock / RateLimiter DOs
  FIREBASE_PROJECT_ID: string;
  TURNSTILE_SECRET: string;
};

const app = new Hono<{ Bindings: Env; Variables: { uid: string; role: string } }>();

app.use("*", cors({ origin: ["https://your-domain.pages.dev"], credentials: true }));

// Public routes (catalog browsing needs no auth — it's also what the
// static SEO pages read from at build time). Cached at the edge for
// 5 minutes: a catalog change doesn't need to be instant.
app.use("/public/batches", edgeCache(300));
app.route("/public/batches", batches.public);

// Everything past here requires a verified Firebase ID token.
app.use("/api/*", firebaseAuth());
app.use("/api/*", rateLimit({ limit: 60, windowSec: 60 })); // per-uid, via Durable Object
app.use("/api/session/*", deviceLock());

// Lecture lists change rarely; a short edge cache absorbs the burst of
// everyone opening the same batch right after a lecture gets posted.
app.use("/api/batches/:id/content", edgeCache(120));
app.route("/api/batches", batches.authed);
app.route("/api/payments", payments);
app.route("/api/attempts", attempts);

// Admin routes carry their own role check inside the router (not just
// middleware) so every handler fails closed by default.
app.route("/api/admin", admin);

app.get("/healthz", (c) => c.text("ok"));

export default app;
