import { Hono } from "hono";
import { NotificationRead } from "@coaching-app/shared/schema";
import type { AppEnv } from "../index";

const app = new Hono<AppEnv>();

// What belongs in a person's inbox, worked out from who they are:
//  ?1 uid   ?2 1 if a student   ?3 1 if a teacher
// Notifications from the last 60 days only.
const MINE = `n.created_at > unixepoch() - 5184000 AND (
  (n.audience = 'user' AND n.audience_value = ?1)
  OR (n.audience = 'all' AND ?2 = 1)
  OR (n.audience = 'teachers' AND ?3 = 1)
  OR (n.audience = 'class' AND ?2 = 1 AND n.audience_value = (SELECT student_class FROM users WHERE uid = ?1))
  OR (n.audience = 'batch' AND n.batch_id IN (
        SELECT batch_id FROM enrollments WHERE uid = ?1 AND (expires_at IS NULL OR expires_at > unixepoch())))
)`;

const who = (c: { get: (k: "uid" | "role" | "isTeacher") => never }) => {
  const role = c.get("role") as string;
  return [c.get("uid") as string, role === "student" ? 1 : 0, role === "teacher" || (c.get("isTeacher") as boolean) ? 1 : 0] as const;
};

app.get("/", async (c) => {
  const [uid, student, teacher] = who(c as never);
  const [rows, unread] = await Promise.all([
    c.env.DB
      .prepare(
        `SELECT n.id, n.kind, n.title_bn, n.title_en, n.body_bn, n.body_en, n.link, n.created_at,
                nr.read_at IS NOT NULL AS read, s.name AS sender_name
         FROM notifications n
         LEFT JOIN notification_reads nr ON nr.notification_id = n.id AND nr.uid = ?1
         LEFT JOIN users s ON s.uid = n.sender_uid
         WHERE ${MINE}
         ORDER BY n.created_at DESC LIMIT 50`,
      )
      .bind(uid, student, teacher)
      .all(),
    c.env.DB
      .prepare(
        `SELECT COUNT(*) AS n FROM notifications n
         WHERE ${MINE} AND NOT EXISTS (SELECT 1 FROM notification_reads r WHERE r.notification_id = n.id AND r.uid = ?1)`,
      )
      .bind(uid, student, teacher)
      .first<{ n: number }>(),
  ]);
  return c.json({ items: rows.results, unread: unread?.n ?? 0 });
});

app.post("/read", async (c) => {
  const parsed = NotificationRead.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_input" }, 400);
  const [uid, student, teacher] = who(c as never);

  if (parsed.data.all) {
    await c.env.DB
      .prepare(`INSERT OR IGNORE INTO notification_reads (uid, notification_id) SELECT ?1, n.id FROM notifications n WHERE ${MINE}`)
      .bind(uid, student, teacher)
      .run();
  } else if (parsed.data.ids?.length) {
    // Only ids that really are in this person's inbox can be marked read.
    await c.env.DB.batch(
      parsed.data.ids.map((id) =>
        c.env.DB
          .prepare(`INSERT OR IGNORE INTO notification_reads (uid, notification_id) SELECT ?1, n.id FROM notifications n WHERE n.id = ?4 AND ${MINE}`)
          .bind(uid, student, teacher, id),
      ),
    );
  }
  return c.json({ ok: true });
});

export default app;
