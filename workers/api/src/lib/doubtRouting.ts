import { notifyUser, type NotifyText } from "./notify";

// A doubt goes to the teachers of the batch the student picked, and to the
// admins. If the doubt names a subject, it goes to the teachers who take that
// subject in the batch; if no one does, to all the batch's teachers, so it is
// never left with nobody.
//
// ?1 is the teacher's uid. d is the doubts table.
export const TEACHER_SEES_DOUBT = `EXISTS (
  SELECT 1 FROM batch_teachers bt
  WHERE bt.teacher_uid = ?1 AND bt.batch_id = d.batch_id
    AND (d.subject IS NULL OR bt.subject IS NULL OR bt.subject = d.subject
         OR NOT EXISTS (SELECT 1 FROM batch_teachers x WHERE x.batch_id = d.batch_id AND x.subject = d.subject))
)`;

export async function teachersForDoubt(db: D1Database, batchId: string, subject: string | null): Promise<string[]> {
  const rows = await db
    .prepare(
      `SELECT DISTINCT bt.teacher_uid AS uid FROM batch_teachers bt
       JOIN users u ON u.uid = bt.teacher_uid AND u.status = 'active'
       WHERE bt.batch_id = ?1
         AND (?2 IS NULL OR bt.subject IS NULL OR bt.subject = ?2
              OR NOT EXISTS (SELECT 1 FROM batch_teachers x WHERE x.batch_id = ?1 AND x.subject = ?2))`,
    )
    .bind(batchId, subject)
    .all<{ uid: string }>();
  return rows.results.map((r) => r.uid);
}

export async function adminUids(db: D1Database): Promise<string[]> {
  const rows = await db.prepare("SELECT uid FROM users WHERE role IN ('support', 'super_admin') AND status = 'active'").all<{ uid: string }>();
  return rows.results.map((r) => r.uid);
}

type Env = { DB: D1Database; FCM_SERVICE_ACCOUNT_JSON?: string };
type Ctx = { waitUntil(p: Promise<unknown>): void } | undefined;

/** Tells the right teachers and every admin that a new doubt has arrived. */
export async function notifyNewDoubt(env: Env, ctx: Ctx, d: { batchId: string; subject: string | null; question: string; studentName: string }) {
  const text: NotifyText = {
    titleBn: `নতুন ডাউট: ${d.studentName}`,
    titleEn: `New doubt from ${d.studentName}`,
    bodyBn: d.question.slice(0, 140),
    bodyEn: d.question.slice(0, 140),
  };
  const [teachers, admins] = await Promise.all([teachersForDoubt(env.DB, d.batchId, d.subject), adminUids(env.DB)]);
  const sent = new Set<string>();
  for (const uid of teachers) {
    sent.add(uid);
    await notifyUser(env, ctx, uid, "doubt_new", text, "teach/doubts");
  }
  for (const uid of admins) {
    if (!sent.has(uid)) await notifyUser(env, ctx, uid, "doubt_new", text, "admin/doubts");
  }
}

export const notifyDoubtAnswered = (env: Env, ctx: Ctx, studentUid: string) =>
  notifyUser(env, ctx, studentUid, "doubt_answered", {
    titleBn: "আপনার ডাউটের উত্তর এসেছে",
    titleEn: "Your doubt has been answered",
  }, "doubt");
