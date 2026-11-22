import { ulid } from "ulidx";
import { sendPushToUids } from "./push";

type Env = { DB: D1Database; FCM_SERVICE_ACCOUNT_JSON?: string };
export type Audience = "all" | "batch" | "class" | "teachers" | "user";
export type NotifyText = { titleBn: string; titleEn: string; bodyBn?: string | null; bodyEn?: string | null };

/** Who an audience means right now. A batch means the students currently enrolled in it. */
export async function recipientUids(db: D1Database, a: { audience: Audience; batchId?: string | null; value?: string | null }): Promise<string[]> {
  const col = async (sql: string, ...binds: unknown[]) => (await db.prepare(sql).bind(...binds).all<{ uid: string }>()).results.map((r) => r.uid);
  switch (a.audience) {
    case "all":
      return col("SELECT uid FROM users WHERE role = 'student' AND status = 'active'");
    case "batch":
      return col(
        "SELECT uid FROM enrollments WHERE batch_id = ? AND (expires_at IS NULL OR expires_at > unixepoch())",
        a.batchId ?? "",
      );
    case "class":
      return col("SELECT uid FROM users WHERE role = 'student' AND status = 'active' AND student_class = ?", a.value ?? "");
    case "teachers":
      return col("SELECT uid FROM users WHERE (role = 'teacher' OR is_teacher = 1) AND status = 'active'");
    case "user":
      return a.value ? [a.value] : [];
  }
}

/**
 * Saves one notification and sends the phone push. The in-app inbox is read
 * from the saved row, so it works even where push is not set up.
 */
export async function sendNotification(
  env: Env,
  ctx: { waitUntil(p: Promise<unknown>): void } | undefined,
  n: { senderUid: string | null; kind?: string; audience: Audience; batchId?: string | null; value?: string | null; text: NotifyText; link?: string | null },
): Promise<{ id: string; recipients: number }> {
  const uids = await recipientUids(env.DB, { audience: n.audience, batchId: n.batchId, value: n.value });
  const id = ulid();
  await env.DB
    .prepare(
      `INSERT INTO notifications (id, sender_uid, kind, audience, audience_value, batch_id, title_bn, title_en, body_bn, body_en, link, recipient_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, n.senderUid, n.kind ?? "announcement", n.audience, n.value ?? null, n.batchId ?? null, n.text.titleBn, n.text.titleEn, n.text.bodyBn ?? null, n.text.bodyEn ?? null, n.link ?? null, uids.length)
    .run();

  const push = sendPushToUids(env, uids, { title: n.text.titleBn, body: n.text.bodyBn ?? n.text.bodyEn ?? "" }, {
    kind: n.kind ?? "announcement",
    notificationId: id,
    ...(n.link ? { link: n.link } : {}),
  }).catch(() => undefined);
  if (ctx) ctx.waitUntil(push);
  else await push;
  return { id, recipients: uids.length };
}

export const notifyUser = (
  env: Env,
  ctx: { waitUntil(p: Promise<unknown>): void } | undefined,
  uid: string,
  kind: string,
  text: NotifyText,
  link?: string,
) => sendNotification(env, ctx, { senderUid: null, kind, audience: "user", value: uid, text, link });

/** Same exec context from a Hono handler, or undefined where there is none (tests). */
export function execCtx(c: { executionCtx: { waitUntil(p: Promise<unknown>): void } }) {
  try {
    return c.executionCtx;
  } catch {
    return undefined;
  }
}
