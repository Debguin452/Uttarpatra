import { sendPushToUids } from "./push";

type Env = { DB: D1Database; FCM_SERVICE_ACCOUNT_JSON?: string };

type DueLecture = {
  id: string;
  batch_id: string;
  batch_title_bn: string;
  chapter: string;
  title_bn: string;
  live_at: number;
};

async function enrolledUids(env: Env, batchId: string): Promise<string[]> {
  const rows = await env.DB
    .prepare(
      `SELECT uid FROM enrollments
       WHERE batch_id = ? AND (expires_at IS NULL OR expires_at > unixepoch())`,
    )
    .bind(batchId)
    .all<{ uid: string }>();
  return rows.results.map((r) => r.uid);
}

/**
 * Runs once a minute (see the cron trigger in wrangler.toml). Finds live
 * lectures starting in ~15 minutes or right now, and sends a push to every
 * enrolled student of that batch — each lecture is only ever alerted once
 * per stage, tracked by alert15_sent_at / alertstart_sent_at.
 *
 * Known gap: a "free" batch has no enrollment rows (access there is kind-
 * based, not enrollment-based), so free-batch lectures currently don't
 * reach anyone through this job.
 */
export async function sendClassReminders(env: Env): Promise<void> {
  const now = Math.floor(Date.now() / 1000);

  const due15 = await env.DB
    .prepare(
      `SELECT id, batch_id, b.title_bn AS batch_title_bn, chapter, title_bn, live_at
       FROM lectures l JOIN batches b ON b.id = l.batch_id
       WHERE l.is_live = 1 AND l.live_at IS NOT NULL
         AND l.live_at BETWEEN ?1 AND ?2
         AND l.alert15_sent_at IS NULL`,
    )
    .bind(now + 13 * 60, now + 16 * 60)
    .all<DueLecture>();

  const dueNow = await env.DB
    .prepare(
      `SELECT id, batch_id, b.title_bn AS batch_title_bn, chapter, title_bn, live_at
       FROM lectures l JOIN batches b ON b.id = l.batch_id
       WHERE l.is_live = 1 AND l.live_at IS NOT NULL
         AND l.live_at BETWEEN ?1 AND ?2
         AND l.alertstart_sent_at IS NULL`,
    )
    .bind(now - 90, now + 60)
    .all<DueLecture>();

  for (const lecture of due15.results) {
    const uids = await enrolledUids(env, lecture.batch_id);
    await sendPushToUids(
      env,
      uids,
      {
        title: `🔴 ${lecture.batch_title_bn}`,
        body: `${lecture.title_bn} (${lecture.chapter}) আর ১৫ মিনিট পর শুরু হচ্ছে!`,
      },
      { kind: "class_reminder_15", batchId: lecture.batch_id, lectureId: lecture.id },
    );
    await env.DB.prepare(`UPDATE lectures SET alert15_sent_at = ?1 WHERE id = ?2`).bind(now, lecture.id).run();
  }

  for (const lecture of dueNow.results) {
    const uids = await enrolledUids(env, lecture.batch_id);
    await sendPushToUids(
      env,
      uids,
      {
        title: `🔴 ${lecture.batch_title_bn}`,
        body: `${lecture.title_bn} (${lecture.chapter}) লাইভ ক্লাস এখনই শুরু হচ্ছে!`,
      },
      { kind: "class_reminder_start", batchId: lecture.batch_id, lectureId: lecture.id },
    );
    await env.DB.prepare(`UPDATE lectures SET alertstart_sent_at = ?1 WHERE id = ?2`).bind(now, lecture.id).run();
  }
}
