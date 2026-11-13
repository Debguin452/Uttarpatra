import { Hono } from "hono";
import { buildAnalyticsOverview, type AnalyticsRaw } from "@coaching-app/shared/analytics";
import type { AppEnv } from "../../index";

const app = new Hono<AppEnv>();

const SEVEN_DAYS_SEC = 7 * 24 * 60 * 60;
const AUDIT_PAGE = 50;

app.get("/overview", async (c) => {
  const db = c.env.DB;
  const nowSec = Math.floor(Date.now() / 1000);

  const [students, signups7d, revenue, pending, attempts, doubts, batchEnrollments, recentSignups] = await Promise.all([
    db
      .prepare(
        `SELECT COUNT(*) AS total, SUM(status = 'active') AS active, SUM(status = 'blocked') AS blocked
         FROM users WHERE role = 'student'`,
      )
      .first<{ total: number; active: number | null; blocked: number | null }>(),
    db
      .prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'student' AND created_at > ?")
      .bind(nowSec - SEVEN_DAYS_SEC)
      .first<{ n: number }>(),
    db
      .prepare("SELECT COALESCE(SUM(amount_paise), 0) AS total FROM payments WHERE status = 'approved'")
      .first<{ total: number }>(),
    db
      .prepare("SELECT COUNT(*) AS n, COALESCE(SUM(amount_paise), 0) AS total FROM payments WHERE status = 'pending'")
      .first<{ n: number; total: number }>(),
    db
      .prepare("SELECT COUNT(*) AS n, AVG(score) AS avg_score FROM attempts WHERE submitted_at IS NOT NULL")
      .first<{ n: number; avg_score: number | null }>(),
    db.prepare("SELECT COUNT(*) AS n FROM doubts WHERE status = 'open'").first<{ n: number }>(),
    db
      .prepare(
        `SELECT b.id AS batch_id, b.title_en, COUNT(e.uid) AS count
         FROM batches b LEFT JOIN enrollments e ON e.batch_id = b.id
         GROUP BY b.id ORDER BY count DESC LIMIT 10`,
      )
      .all<{ batch_id: string; title_en: string; count: number }>(),
    db
      .prepare("SELECT uid, name, created_at FROM users WHERE role = 'student' ORDER BY created_at DESC LIMIT 10")
      .all(),
  ]);

  const raw: AnalyticsRaw = {
    totalStudents: students?.total ?? 0,
    activeStudents: students?.active ?? 0,
    blockedStudents: students?.blocked ?? 0,
    newSignups7d: signups7d?.n ?? 0,
    revenueApprovedPaise: revenue?.total ?? 0,
    pendingPaymentsCount: pending?.n ?? 0,
    pendingPaymentsAmountPaise: pending?.total ?? 0,
    totalAttempts: attempts?.n ?? 0,
    avgScoreRaw: attempts?.avg_score ?? null,
    openDoubts: doubts?.n ?? 0,
    batchEnrollments: batchEnrollments.results.map((b) => ({
      batchId: b.batch_id,
      titleEn: b.title_en,
      count: b.count,
    })),
  };

  return c.json({ ...buildAnalyticsOverview(raw), recentSignups: recentSignups.results });
});

app.get("/audit-log", async (c) => {
  const cursor = Number(c.req.query("cursor") ?? "");
  const paged = Number.isFinite(cursor) && cursor > 0;

  const rows = await c.env.DB
    .prepare(
      `SELECT a.id, a.actor_uid, u.name AS actor_name, a.action, a.target, a.meta_json, a.created_at
       FROM audit_log a LEFT JOIN users u ON u.uid = a.actor_uid
       ${paged ? "WHERE a.id < ?" : ""} ORDER BY a.id DESC LIMIT ${AUDIT_PAGE}`,
    )
    .bind(...(paged ? [cursor] : []))
    .all<{ id: number }>();

  const last = rows.results[rows.results.length - 1];
  const nextCursor = rows.results.length === AUDIT_PAGE && last ? last.id : null;
  return c.json({ entries: rows.results, nextCursor });
});

export default app;
