import { Hono } from "hono";
import { cors } from "hono/cors";
import { firebaseAuth, requireRegistered } from "./middleware/firebaseAuth";
import { guard } from "./middleware/guard";
import { edgeCache } from "./middleware/edgeCache";
import batches from "./routes/batches";
import me from "./routes/me";
import notices from "./routes/notices";
import payments from "./routes/payments";
import tests from "./routes/tests";
import attempts from "./routes/attempts";
import admin from "./routes/admin";
import teacherApplication from "./routes/teacherApplication";

export { SessionGuard } from "./do/SessionGuard";

export type Env = {
  DB: D1Database;
  SESSIONS: DurableObjectNamespace;
  FIREBASE_PROJECT_ID: string;
  TURNSTILE_SECRET: string;
  ALLOWED_ORIGIN: string;
};

export type AppEnv = { Bindings: Env; Variables: { uid: string; role: string } };

const app = new Hono<AppEnv>();

app.use(
  "*",
  cors({
    origin: (origin, c) => (c.env.ALLOWED_ORIGIN.split(",").includes(origin) ? origin : null),
    allowHeaders: ["authorization", "content-type", "x-device-id", "cf-turnstile-token"],
    exposeHeaders: ["x-edge-age"],
    maxAge: 86400,
  }),
);

app.get("/healthz", (c) => c.text("ok"));

app.use("/public/batches", edgeCache(300));
app.route("/public/batches", batches.public);

app.use("/api/*", firebaseAuth());
app.use("/api/*", guard({ limit: 90, windowSec: 60 }));
app.route("/api/me", me);

app.use("/api/*", requireRegistered());
app.route("/api/batches", batches.authed);
app.route("/api/notices", notices);
app.route("/api/payments", payments);
app.route("/api/tests", tests);
app.route("/api/attempts", attempts);
app.route("/api/teacher-application", teacherApplication);
app.route("/api/admin", admin);

export default app;
