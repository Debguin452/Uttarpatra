import { useState } from "preact/hooks";
import { t } from "@coaching-app/shared/i18n";
import { TeacherNotificationSend } from "@coaching-app/shared/schema";
import { Field } from "../../components/adminUi";
import { Select } from "../../components/Select";
import { Loading } from "../../components/ui";
import { api, ApiError } from "../../lib/api";
import { errorText, pick, when } from "../../lib/format";
import type { TeacherPortal } from "../../lib/types";
import { useLoad } from "../../lib/useLoad";

type Sent = {
  id: string;
  batch_title_en: string | null;
  title_bn: string;
  title_en: string;
  recipient_count: number;
  read_count: number;
  created_at: number;
};

// A teacher can message only the students of the batches they teach.
export function TeacherNotifications() {
  const portal = useLoad(() => api<TeacherPortal>("/api/teacher-application"));
  const history = useLoad(() => api<Sent[]>("/api/teacher/notifications"));
  const [batchId, setBatchId] = useState("");
  const [titleBn, setTitleBn] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [bodyBn, setBodyBn] = useState("");
  const [bodyEn, setBodyEn] = useState("");
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const batches = [...new Map((portal.data?.batches ?? []).map((b) => [b.id, b])).values()];
  const chosen = batchId || (batches.length === 1 ? batches[0]!.id : "");

  async function send() {
    setDone(null);
    const parsed = TeacherNotificationSend.safeParse({
      batchId: chosen,
      titleBn,
      titleEn,
      bodyBn: bodyBn.trim() || null,
      bodyEn: bodyEn.trim() || null,
    });
    if (!parsed.success) {
      setErrors(parsed.error.flatten().fieldErrors);
      return;
    }
    setErrors({});
    setFailure(null);
    setBusy(true);
    try {
      const r = await api<{ recipients: number }>("/api/teacher/notifications", { body: parsed.data });
      setDone(r.recipients);
      setTitleBn("");
      setTitleEn("");
      setBodyBn("");
      setBodyEn("");
      await history.reload();
    } catch (e) {
      setFailure(errorText(e instanceof ApiError ? e.code : "network"));
    }
    setBusy(false);
  }

  const problem = (key: string) => errors[key]?.[0];
  if (portal.loading && !portal.data) return <Loading />;

  return (
    <div class="stack">
      <h1 class="title">{t("teach_notify_title")}</h1>
      <p class="muted small">{t("teach_notify_hint")}</p>
      {batches.length === 0 ? (
        <p class="muted small">{t("teach_notify_no_batches")}</p>
      ) : (
        <>
          <Field id="tn-batch" label={t("teach_notify_batch")} error={problem("batchId")}>
            <Select id="tn-batch" value={chosen} placeholder={t("admin_target_pick")} onChange={setBatchId} options={batches.map((b) => ({ value: b.id, label: pick(b, "title") }))} />
          </Field>
          <Field id="tn-title-en" label={t("admin_title_en")} error={problem("titleEn")}>
            <input id="tn-title-en" class="input" maxLength={120} value={titleEn} onInput={(e) => setTitleEn(e.currentTarget.value)} />
          </Field>
          <Field id="tn-title-bn" label={t("admin_title_bn")} error={problem("titleBn")}>
            <input id="tn-title-bn" class="input" maxLength={120} value={titleBn} onInput={(e) => setTitleBn(e.currentTarget.value)} />
          </Field>
          <Field id="tn-body-en" label={t("notif_body_en")}>
            <textarea id="tn-body-en" class="input" rows={3} maxLength={600} value={bodyEn} onInput={(e) => setBodyEn((e.currentTarget as HTMLTextAreaElement).value)} />
          </Field>
          <Field id="tn-body-bn" label={t("notif_body_bn")}>
            <textarea id="tn-body-bn" class="input" rows={3} maxLength={600} value={bodyBn} onInput={(e) => setBodyBn((e.currentTarget as HTMLTextAreaElement).value)} />
          </Field>
          {failure && <p class="error-text">{failure}</p>}
          {done !== null && <p class="notice">{t("notif_sent", { n: done })}</p>}
          <button class="btn primary block" onClick={send} disabled={busy}>
            {t("notif_send")}
          </button>
        </>
      )}

      <h2 class="subtitle">{t("notif_history")}</h2>
      {history.data?.length === 0 && <p class="muted small">{t("notif_none_sent")}</p>}
      <div class="list">
        {(history.data ?? []).map((n) => (
          <div class="item" key={n.id}>
            <span class="name">{pick(n, "title")}</span>
            <span class="meta">
              {[n.batch_title_en, t("notif_reach", { sent: n.recipient_count, read: n.read_count }), when(n.created_at)].filter(Boolean).join(" · ")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
