import { Hono } from "hono";
import { TeacherApplication, TeacherProfileUpdate } from "@coaching-app/shared/schema";
import type { AppEnv } from "../index";

type ApplicationRow = {
  subjects: string;
  qualification: string;
  experience_years: number;
  phone: string;
  bio: string;
  demo_url: string | null;
  status: string;
  review_note: string | null;
  created_at: number;
};

const app = new Hono<AppEnv>();

app.get("/", async (c) => {
  const uid = c.get("uid");
  const role = c.get("role");
  const hasTeacherAccess = role === "teacher" || c.get("isTeacher");

  const row = await c.env.DB
    .prepare(
      `SELECT subjects, qualification, experience_years, phone, bio, demo_url, status, review_note, created_at
       FROM teacher_applications WHERE uid = ?`,
    )
    .bind(uid)
    .first<ApplicationRow>();

  const batches =
    hasTeacherAccess
      ? (
          await c.env.DB
            .prepare(
              `SELECT b.id, b.title_bn, b.title_en, bt.subject
               FROM batch_teachers bt JOIN batches b ON b.id = bt.batch_id
               WHERE bt.teacher_uid = ? ORDER BY b.title_en`,
            )
            .bind(uid)
            .all()
        ).results
      : [];

  return c.json({
    role,
    isTeacher: hasTeacherAccess,
    application: row ? { ...row, subjects: JSON.parse(row.subjects) as string[] } : null,
    batches,
  });
});

app.put("/", async (c) => {
  if (c.get("role") !== "student") return c.json({ error: "already_staff" }, 409);

  const parsed = TeacherApplication.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_input", issues: parsed.error.flatten() }, 400);
  const { subjects, qualification, experienceYears, phone, bio, demoUrl } = parsed.data;

  const unique = [...new Set(subjects)];
  const known = await c.env.DB
    .prepare(`SELECT COUNT(*) AS n FROM subjects WHERE active = 1 AND id IN (${unique.map(() => "?").join(",")})`)
    .bind(...unique)
    .first<{ n: number }>();
  if (known?.n !== unique.length) return c.json({ error: "invalid_subject" }, 400);

  await c.env.DB
    .prepare(
      `INSERT INTO teacher_applications (uid, subjects, qualification, experience_years, phone, bio, demo_url)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(uid) DO UPDATE SET
         subjects = excluded.subjects, qualification = excluded.qualification,
         experience_years = excluded.experience_years, phone = excluded.phone, bio = excluded.bio,
         demo_url = excluded.demo_url, status = 'pending', review_note = NULL,
         reviewed_by = NULL, reviewed_at = NULL, updated_at = unixepoch()`,
    )
    .bind(c.get("uid"), JSON.stringify(unique), qualification, experienceYears, phone, bio, demoUrl ?? null)
    .run();

  return c.json({ ok: true });
});

// Approved teachers keep their public profile (what students see on a batch
// page) up to date. Unlike the application form this does not send the
// teacher back to "pending": subjects and batch assignment stay with the admin.
app.put("/profile", async (c) => {
  if (c.get("role") !== "teacher" && !c.get("isTeacher")) return c.json({ error: "not_a_teacher" }, 403);

  const parsed = TeacherProfileUpdate.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_input", issues: parsed.error.flatten() }, 400);
  const { qualification, experienceYears, phone, bio, demoUrl } = parsed.data;

  await c.env.DB
    .prepare(
      `INSERT INTO teacher_applications (uid, subjects, qualification, experience_years, phone, bio, demo_url, status)
       VALUES (?, '[]', ?, ?, ?, ?, ?, 'approved')
       ON CONFLICT(uid) DO UPDATE SET
         qualification = excluded.qualification, experience_years = excluded.experience_years,
         phone = excluded.phone, bio = excluded.bio, demo_url = excluded.demo_url,
         updated_at = unixepoch()`,
    )
    .bind(c.get("uid"), qualification, experienceYears, phone, bio, demoUrl ?? null)
    .run();

  return c.json({ ok: true });
});

export default app;
