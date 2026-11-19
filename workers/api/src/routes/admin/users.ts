import { Hono } from "hono";
import { PaymentReview, RoleUpdate, EnrollGrant, TeacherAccessUpdate } from "@coaching-app/shared/schema";
import { requireRole } from "../../middleware/firebaseAuth";
import type { AppEnv } from "../../index";

const app = new Hono<AppEnv>();

const audit = (db: D1Database, actor: string, action: string, target: string, meta?: unknown) =>
  db
    .prepare("INSERT INTO audit_log (actor_uid, action, target, meta_json) VALUES (?, ?, ?, ?)")
    .bind(actor, action, target, meta === undefined ? null : JSON.stringify(meta));

const userExists = async (db: D1Database, uid: string) =>
  Boolean(await db.prepare("SELECT 1 FROM users WHERE uid = ?").bind(uid).first());

app.get("/payments/pending", async (c) => {
  const rows = await c.env.DB
    .prepare(
      `SELECT p.id, p.uid, u.name, p.batch_id, p.amount_paise, p.utr, p.coupon_code, p.created_at
       FROM payments p JOIN users u ON u.uid = p.uid
       WHERE p.status = 'pending' ORDER BY p.created_at ASC LIMIT 50`,
    )
    .all();
  return c.json(rows.results);
});

app.get("/payments/:id/screenshot", async (c) => {
  const row = await c.env.DB
    .prepare("SELECT screenshot_b64 FROM payments WHERE id = ?")
    .bind(c.req.param("id"))
    .first<{ screenshot_b64: string | null }>();
  if (!row) return c.json({ error: "not_found" }, 404);
  return c.json({ screenshotBase64: row.screenshot_b64 });
});

app.post("/payments/review", async (c) => {
  const parsed = PaymentReview.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_input" }, 400);
  const { paymentId, decision, note } = parsed.data;

  const payment = await c.env.DB
    .prepare("SELECT uid, batch_id, status, coupon_code FROM payments WHERE id = ?")
    .bind(paymentId)
    .first<{ uid: string; batch_id: string; status: string; coupon_code: string | null }>();
  if (!payment) return c.json({ error: "not_found" }, 404);
  if (payment.status !== "pending") return c.json({ error: "already_reviewed" }, 409);

  const claim = await c.env.DB
    .prepare("UPDATE payments SET status = ?, reviewed_by = ?, reviewed_at = unixepoch() WHERE id = ? AND status = 'pending'")
    .bind(decision, c.get("uid"), paymentId)
    .run();
  if (claim.meta.changes === 0) return c.json({ error: "already_reviewed" }, 409);

  const statements = [audit(c.env.DB, c.get("uid"), `payment.${decision}`, paymentId, { note })];

  if (decision === "approved") {
    statements.push(
      c.env.DB
        .prepare("INSERT OR IGNORE INTO enrollments (uid, batch_id, granted_by) VALUES (?, ?, 'payment')")
        .bind(payment.uid, payment.batch_id),
    );
    if (payment.coupon_code) {
      statements.push(
        c.env.DB.prepare("UPDATE coupons SET used_count = used_count + 1 WHERE code = ?").bind(payment.coupon_code),
      );
    }
  }

  await c.env.DB.batch(statements);
  return c.json({ ok: true });
});

app.get("/users/search", async (c) => {
  const q = (c.req.query("q") ?? "").trim();

  // No query at all (admin just opened the tab) -> the default view
  // is "everyone", newest first, not an empty screen that only
  // reacts once you type something.
  if (q.length === 0) {
    const rows = await c.env.DB
      .prepare(
        `SELECT u.uid, u.name, u.phone, u.role, u.status, u.is_teacher, u.created_at
         FROM users u ORDER BY u.created_at DESC LIMIT 50`,
      )
      .all();
    return c.json(rows.results);
  }
  if (q.length < 2) return c.json([]);
  const escaped = q.replace(/[%_\\]/g, (m) => `\\${m}`);
  const like = `%${escaped}%`;
  const rows = await c.env.DB
    .prepare(
      `SELECT u.uid, u.name, u.phone, u.role, u.status, u.is_teacher,
              u.created_at
       FROM users u
       WHERE u.uid = ? OR u.name LIKE ? ESCAPE '\\' OR u.phone LIKE ? ESCAPE '\\'
       ORDER BY u.name LIMIT 20`,
    )
    .bind(q, like, like)
    .all();
  return c.json(rows.results);
});

app.get("/users/:uid", async (c) => {
  const uid = c.req.param("uid");

  const [user, enrollments, payments, attemptStats] = await Promise.all([
    c.env.DB
      .prepare(
        `SELECT u.uid, u.role, u.name, u.phone, u.student_class, u.board, u.school, u.status, u.is_teacher,
                u.created_at
         FROM users u WHERE u.uid = ?`,
      )
      .bind(uid)
      .first(),
    c.env.DB
      .prepare(
        `SELECT e.batch_id, b.title_en, e.granted_by, e.expires_at, e.created_at
         FROM enrollments e JOIN batches b ON b.id = e.batch_id
         WHERE e.uid = ? ORDER BY e.created_at DESC`,
      )
      .bind(uid)
      .all(),
    c.env.DB
      .prepare(
        `SELECT id, batch_id, amount_paise, status, utr, created_at, reviewed_at
         FROM payments WHERE uid = ? ORDER BY created_at DESC LIMIT 20`,
      )
      .bind(uid)
      .all(),
    c.env.DB
      .prepare(
        `SELECT COUNT(*) AS total_attempts, AVG(score) AS avg_score
         FROM attempts WHERE uid = ? AND submitted_at IS NOT NULL`,
      )
      .bind(uid)
      .first<{ total_attempts: number; avg_score: number | null }>(),
  ]);

  if (!user) return c.json({ error: "not_found" }, 404);

  return c.json({
    user,
    enrollments: enrollments.results,
    payments: payments.results,
    testStats: {
      totalAttempts: attemptStats?.total_attempts ?? 0,
      averageScore: attemptStats?.avg_score ?? null,
    },
  });
});

app.post("/users/:uid/status", requireRole("super_admin"), async (c) => {
  const body = (await c.req.json().catch(() => null)) as { status?: string } | null;
  if (body?.status !== "active" && body?.status !== "blocked") return c.json({ error: "invalid_input" }, 400);
  const uid = c.req.param("uid");
  if (uid === c.get("uid")) return c.json({ error: "cannot_change_self" }, 400);

  const claim = await c.env.DB
    .prepare("UPDATE users SET status = ?, updated_at = unixepoch() WHERE uid = ?")
    .bind(body.status, uid)
    .run();
  if (claim.meta.changes === 0) return c.json({ error: "not_found" }, 404);

  await audit(c.env.DB, c.get("uid"), `user.${body.status}`, uid).run();
  return c.json({ ok: true });
});

app.post("/users/:uid/role", requireRole("super_admin"), async (c) => {
  const parsed = RoleUpdate.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_input", issues: parsed.error.flatten() }, 400);
  const uid = c.req.param("uid");
  const next = parsed.data.role;
  if (uid === c.get("uid")) return c.json({ error: "cannot_change_self" }, 400);

  const current = await c.env.DB.prepare("SELECT role FROM users WHERE uid = ?").bind(uid).first<{ role: string }>();
  if (!current) return c.json({ error: "not_found" }, 404);
  if (current.role === next) return c.json({ ok: true });

  const statements = [
    c.env.DB.prepare("UPDATE users SET role = ?, updated_at = unixepoch() WHERE uid = ?").bind(next, uid),
    audit(c.env.DB, c.get("uid"), "user.role_change", uid, { from: current.role, to: next }),
  ];
  if (current.role === "teacher") {
    statements.push(
      c.env.DB.prepare("DELETE FROM batch_teachers WHERE teacher_uid = ?").bind(uid),
      c.env.DB
        .prepare("UPDATE teacher_applications SET status = 'suspended', updated_at = unixepoch() WHERE uid = ?")
        .bind(uid),
    );
  }
  await c.env.DB.batch(statements);
  return c.json({ ok: true });
});

app.post("/users/:uid/teacher-access", requireRole("super_admin"), async (c) => {
  const parsed = TeacherAccessUpdate.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_input", issues: parsed.error.flatten() }, 400);
  const uid = c.req.param("uid");
  const { enabled } = parsed.data;

  const target = await c.env.DB.prepare("SELECT role FROM users WHERE uid = ?").bind(uid).first<{ role: string }>();
  if (!target) return c.json({ error: "not_found" }, 404);
  if (target.role !== "support" && target.role !== "super_admin") {
    return c.json({ error: "not_an_admin" }, 400);
  }

  const statements = [
    c.env.DB
      .prepare("UPDATE users SET is_teacher = ?, updated_at = unixepoch() WHERE uid = ?")
      .bind(enabled ? 1 : 0, uid),
    audit(c.env.DB, c.get("uid"), "user.teacher_access", uid, { enabled }),
  ];
  if (!enabled) {
    statements.push(c.env.DB.prepare("DELETE FROM batch_teachers WHERE teacher_uid = ?").bind(uid));
  }
  await c.env.DB.batch(statements);
  return c.json({ ok: true });
});

app.post("/users/:uid/enroll", requireRole("super_admin"), async (c) => {
  const parsed = EnrollGrant.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_input", issues: parsed.error.flatten() }, 400);
  const uid = c.req.param("uid");
  const { batchId, expiresAt } = parsed.data;

  if (expiresAt && expiresAt <= Math.floor(Date.now() / 1000)) return c.json({ error: "invalid_expiry" }, 400);

  const [userOk, batchOk] = await Promise.all([
    userExists(c.env.DB, uid),
    c.env.DB.prepare("SELECT 1 FROM batches WHERE id = ?").bind(batchId).first(),
  ]);
  if (!userOk) return c.json({ error: "not_found" }, 404);
  if (!batchOk) return c.json({ error: "batch_not_found" }, 400);

  await c.env.DB.batch([
    c.env.DB
      .prepare(
        `INSERT INTO enrollments (uid, batch_id, granted_by, expires_at)
         VALUES (?, ?, 'admin', ?)
         ON CONFLICT(uid, batch_id) DO UPDATE SET expires_at = excluded.expires_at, granted_by = 'admin'`,
      )
      .bind(uid, batchId, expiresAt ?? null),
    audit(c.env.DB, c.get("uid"), "user.enroll", uid, { batchId, expiresAt: expiresAt ?? null }),
  ]);
  return c.json({ ok: true });
});

app.delete("/users/:uid/enroll/:batchId", requireRole("super_admin"), async (c) => {
  const uid = c.req.param("uid");
  const batchId = c.req.param("batchId");

  const claim = await c.env.DB
    .prepare("DELETE FROM enrollments WHERE uid = ? AND batch_id = ?")
    .bind(uid, batchId)
    .run();
  if (claim.meta.changes === 0) return c.json({ error: "not_found" }, 404);

  await audit(c.env.DB, c.get("uid"), "user.unenroll", uid, { batchId }).run();
  return c.json({ ok: true });
});

export default app;
