import { useState } from "preact/hooks";
import { t } from "@coaching-app/shared/i18n";
import { NotificationSend } from "@coaching-app/shared/schema";
import { ConfirmSheet, Field } from "../../components/adminUi";
import { Select } from "../../components/Select";
import { Loading } from "../../components/ui";
import { api, ApiError } from "../../lib/api";
import type { AdminBatchRow } from "../../lib/adminTypes";
import { errorText, pick, when } from "../../lib/format";
import { useLoad } from "../../lib/useLoad";

type Sent = {
  id: string;
  audience: string;
  audience_value: string | null;
  batch_title_en: string | null;
  title_bn: string;
  title_en: string;
  body_bn: string | null;
  body_en: string | null;
  recipient_count: number;
  read_count: number;
  created_at: number;
  sender_name: string | null;
};

type Audience = "all" | "batch" | "class" | "teachers" | "user";
const CLASSES = ["5", "6", "7", "8", "9", "10", "11", "12", "dropper"];

export function AdminNotifications() {
  const history = useLoad(() => api<Sent[]>("/api/admin/notifications"));
  const batches = useLoad(() => api<AdminBatchRow[]>("/api/admin/batches"));
  const [audience, setAudience] = useState<Audience>("all");
  const [batchId, setBatchId] = useState("");
  const [studentClass, setStudentClass] = useState("");
  const [userId, setUserId] = useState("");
  const [titleBn, setTitleBn] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [bodyBn, setBodyBn] = useState("");
  const [bodyEn, setBodyEn] = useState("");
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<Sent | null>(null);

  async function send() {
    setDone(null);
    const parsed = NotificationSend.safeParse({
      audience,
      batchId: audience === "batch" ? batchId || undefined : undefined,
      studentClass: audience === "class" ? studentClass || undefined : undefined,
      userId: audience === "user" ? userId.trim() || undefined : undefined,
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
      const r = await api<{ recipients: number }>("/api/admin/notifications", { body: parsed.data });
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

  async function remove() {
    if (!deleting) return;
    setBusy(true);
    await api(`/api/admin/notifications/${deleting.id}`, { method: "DELETE" }).catch(() => undefined);
    setDeleting(null);
    setBusy(false);
    await history.reload();
  }

  const problem = (key: string) => errors[key]?.[0];
  const audienceLabel = (n: Sent) =>
    n.audience === "batch"
      ? `${t("notif_aud_batch")}: ${n.batch_title_en ?? ""}`
      : n.audience === "class"
        ? `${t("notif_aud_class")}: ${n.audience_value}`
        : t(`notif_aud_${n.audience}`);

  return (
    <div class="stack">
      <h2 class="subtitle">{t("notif_send_title")}</h2>
      <Field id="n-aud" label={t("notif_audience")}>
        <Select
          id="n-aud"
          value={audience}
          onChange={(v) => setAudience(v as Audience)}
          options={(["all", "batch", "class", "teachers", "user"] as const).map((a) => ({ value: a, label: t(`notif_aud_${a}`) }))}
        />
      </Field>
      {audience === "batch" && (
        <Field id="n-batch" label={t("admin_target_batch")} error={problem("batchId")}>
          <Select id="n-batch" value={batchId} searchable placeholder={t("admin_target_pick")} onChange={setBatchId} options={(batches.data ?? []).map((b) => ({ value: b.id, label: pick(b, "title") }))} />
        </Field>
      )}
      {audience === "class" && (
        <Field id="n-class" label={t("notif_aud_class")} error={problem("studentClass")}>
          <Select id="n-class" value={studentClass} placeholder={t("admin_target_pick")} onChange={setStudentClass} options={CLASSES.map((c) => ({ value: c, label: t(`class_${c}`) }))} />
        </Field>
      )}
      {audience === "user" && (
        <Field id="n-user" label={t("notif_user_id")} hint={t("notif_user_hint")} error={problem("userId")}>
          <input id="n-user" class="input" value={userId} onInput={(e) => setUserId(e.currentTarget.value)} />
        </Field>
      )}
      <Field id="n-title-en" label={t("admin_title_en")} error={problem("titleEn")}>
        <input id="n-title-en" class="input" maxLength={120} value={titleEn} onInput={(e) => setTitleEn(e.currentTarget.value)} />
      </Field>
      <Field id="n-title-bn" label={t("admin_title_bn")} error={problem("titleBn")}>
        <input id="n-title-bn" class="input" maxLength={120} value={titleBn} onInput={(e) => setTitleBn(e.currentTarget.value)} />
      </Field>
      <Field id="n-body-en" label={t("notif_body_en")}>
        <textarea id="n-body-en" class="input" rows={3} maxLength={600} value={bodyEn} onInput={(e) => setBodyEn((e.currentTarget as HTMLTextAreaElement).value)} />
      </Field>
      <Field id="n-body-bn" label={t("notif_body_bn")}>
        <textarea id="n-body-bn" class="input" rows={3} maxLength={600} value={bodyBn} onInput={(e) => setBodyBn((e.currentTarget as HTMLTextAreaElement).value)} />
      </Field>
      {failure && <p class="error-text">{failure}</p>}
      {done !== null && <p class="notice">{t("notif_sent", { n: done })}</p>}
      <button class="btn primary block" onClick={send} disabled={busy}>
        {t("notif_send")}
      </button>

      <h2 class="subtitle">{t("notif_history")}</h2>
      {history.loading && !history.data && <Loading />}
      {history.data?.length === 0 && <p class="muted small">{t("notif_none_sent")}</p>}
      <div class="list">
        {(history.data ?? []).map((n) => (
          <button class="item" key={n.id} onClick={() => setDeleting(n)}>
            <span class="name">{pick(n, "title")}</span>
            <span class="meta">
              {audienceLabel(n)} · {t("notif_reach", { sent: n.recipient_count, read: n.read_count })} · {when(n.created_at)}
            </span>
          </button>
        ))}
      </div>
      {deleting && (
        <ConfirmSheet
          title={t("notif_delete_title")}
          body={t("notif_delete_body")}
          confirmLabel={t("admin_delete")}
          danger
          busy={busy}
          onConfirm={remove}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
