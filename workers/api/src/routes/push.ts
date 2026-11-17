import { Hono } from "hono";
import { PushTokenRegister, PushTokenUnregister } from "@coaching-app/shared/schema";
import type { AppEnv } from "../index";

const app = new Hono<AppEnv>();

app.post("/register", async (c) => {
  const uid = c.get("uid");
  const parsed = PushTokenRegister.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_input", issues: parsed.error.flatten() }, 400);

  await c.env.DB
    .prepare(
      `INSERT INTO push_tokens (uid, token, platform) VALUES (?, ?, ?)
       ON CONFLICT (uid, token) DO UPDATE SET platform = excluded.platform`,
    )
    .bind(uid, parsed.data.token, parsed.data.platform)
    .run();

  return c.json({ ok: true });
});

app.post("/unregister", async (c) => {
  const uid = c.get("uid");
  const parsed = PushTokenUnregister.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_input", issues: parsed.error.flatten() }, 400);

  await c.env.DB.prepare(`DELETE FROM push_tokens WHERE uid = ? AND token = ?`).bind(uid, parsed.data.token).run();
  return c.json({ ok: true });
});

export default app;
