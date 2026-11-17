import { Hono } from "hono";
import { AvatarUpdate, ProfileUpsert } from "@coaching-app/shared/schema";
import type { AppEnv } from "../index";

const app = new Hono<AppEnv>();

app.get("/", async (c) => {
  if (c.get("role") === "guest") return c.json({ registered: false });

  const uid = c.get("uid");
  const [user, enrollments] = await Promise.all([
    c.env.DB
      .prepare("SELECT uid, role, name, phone, student_class, board, school, photo_url FROM users WHERE uid = ?")
      .bind(uid)
      .first(),
    c.env.DB
      .prepare(
        "SELECT batch_id, expires_at FROM enrollments WHERE uid = ? AND (expires_at IS NULL OR expires_at > unixepoch())",
      )
      .bind(uid)
      .all(),
  ]);

  return c.json({ registered: true, user, enrollments: enrollments.results });
});

app.put("/", async (c) => {
  const parsed = ProfileUpsert.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_input", issues: parsed.error.flatten() }, 400);
  const { name, phone, studentClass, board, school } = parsed.data;

  await c.env.DB
    .prepare(
      `INSERT INTO users (uid, name, phone, student_class, board, school)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(uid) DO UPDATE SET
         name = excluded.name, phone = excluded.phone, student_class = excluded.student_class,
         board = excluded.board, school = excluded.school, updated_at = unixepoch()`,
    )
    .bind(c.get("uid"), name, phone ?? null, studentClass ?? null, board ?? null, school ?? null)
    .run();

  return c.json({ ok: true });
});

app.put("/avatar", async (c) => {
  if (c.get("role") === "guest") return c.json({ error: "not_found" }, 404);
  const parsed = AvatarUpdate.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_input" }, 400);

  await c.env.DB
    .prepare("UPDATE users SET photo_url = ?, updated_at = unixepoch() WHERE uid = ?")
    .bind(parsed.data.photo, c.get("uid"))
    .run();
  return c.json({ ok: true });
});

export default app;
