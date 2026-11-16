import { useState } from "preact/hooks";
import { t } from "@coaching-app/shared/i18n";
import { NoticeUpsert } from "@coaching-app/shared/schema";
import { ConfirmSheet, Field } from "../../components/adminUi";
import { Select } from "../../components/Select";
import { Loading, Sheet } from "../../components/ui";
import { api, ApiError } from "../../lib/api";
import type { AdminNotice } from "../../lib/adminTypes";
import { errorText, pick, when } from "../../lib/format";
import type { TeacherPortal } from "../../lib/types";
import { useLoad } from "../../lib/useLoad";

type Draft = {
  id: string | null;
  titleBn: string;
  titleEn: string;
  bodyBn: string;
  bodyEn: string;
  batchId: string;
  pinned: boolean;
};

const EMPTY: Draft = { id: null, titleBn: "", titleEn: "", bodyBn: "", bodyEn: "", batchId: "", pinned: false };

const toDraft = (n: AdminNotice): Draft => ({
  id: n.id,
  titleBn: n.title_bn,
  titleEn: n.title_en,
  bodyBn: n.body_bn ?? "",
  bodyEn: n.body_en ?? "",
  batchId: n.batch_id ?? "",
  pinned: Boolean(n.pinned),
});

export function TeacherNotices() {
  const portal = useLoad(() => api<TeacherPortal>("/api/teacher-application"));
  const batchOptions = (portal.data?.batches ?? []).map((b) => ({ value: b.id, label: pick(b, "title") }));

  const list = useLoad(() => api<AdminNotice[]>("/api/teacher/notices"));
  const [draft, setDraft] = useState<Draft | null>(null);
  const [deleting, setDeleting] = useState<AdminNotice | null>(null);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const close = () => {
    setDraft(null);
    setDeleting(null);
    setErrors({});
    setFailure(null);
  };

  async function save() {
    if (!draft) return;
    const parsed = NoticeUpsert.safeParse({
      titleBn: draft.titleBn,
      titleEn: draft.titleEn,
      bodyBn: draft.bodyBn.trim() || undefined,
      bodyEn: draft.bodyEn.trim() || undefined,
      batchId: draft.batchId,
      pinned: draft.pinned,
    });
    if (!parsed.success) {
      setErrors(parsed.error.flatten().fieldErrors);
      return;
    }
    setErrors({});
    setFailure(null);
    setBusy(true);
    try {
      if (draft.id) await api(`/api/teacher/notices/${draft.id}`, { method: "PUT", body: parsed.data });
      else await api("/api/teacher/notices", { body: parsed.data });
      close();
      await list.reload();
    } catch (e) {
      setFailure(errorText(e instanceof ApiError ? e.code : "network"));
    }
    setBusy(false);
  }

  async function remove() {
    if (!deleting) return;
    setBusy(true);
    try {
      await api(`/api/teacher/notices/${deleting.id}`, { method: "DELETE" });
      close();
      await list.reload();
    } catch (e) {
      setFailure(errorText(e instanceof ApiError ? e.code : "network"));
    }
    setBusy(false);
  }

  const patch = (changes: Partial<Draft>) => setDraft((current) => (current ? { ...current, ...changes } : current));
  const problem = (key: string) => errors[key]?.[0];

  return (
    <div class="stack">
      <div class="row-between">
        <h1 class="title">{t("teach_tab_notices")}</h1>
        <button class="btn primary" onClick={() => setDraft({ ...EMPTY, batchId: batchOptions[0]?.value ?? "" })} disabled={batchOptions.length === 0}>
          {t("admin_new_notice")}
        </button>
      </div>
      {batchOptions.length === 0 && !portal.loading && <p class="muted small">{t("teach_no_batches")}</p>}

      {list.error && <p class="error-text">{list.error}</p>}
      {list.loading && !list.data && <Loading />}
      {list.data && list.data.length === 0 && <p class="muted small">{t("no_notices")}</p>}

      <div class="list">
        {(list.data ?? []).map((notice) => (
          <button class="item" key={notice.id} onClick={() => setDraft(toDraft(notice))}>
            <span class="name">{pick(notice, "title")}</span>
            <span class="meta">
              {notice.batch_title_en} · {when(notice.created_at)}
            </span>
            <span class="side">{notice.pinned ? <span class="badge live">{t("admin_pinned")}</span> : null}</span>
          </button>
        ))}
      </div>

      {draft && !deleting && (
        <Sheet onClose={busy ? undefined : close}>
          <h2 class="subtitle">{draft.id ? t("admin_edit_notice") : t("admin_new_notice")}</h2>
          <div class="stack">
            <Field id="tn-title-en" label={t("admin_title_en")} error={problem("titleEn")}>
              <input id="tn-title-en" class="input" value={draft.titleEn} onInput={(e) => patch({ titleEn: e.currentTarget.value })} />
            </Field>
            <Field id="tn-title-bn" label={t("admin_title_bn")} error={problem("titleBn")}>
              <input id="tn-title-bn" class="input" value={draft.titleBn} onInput={(e) => patch({ titleBn: e.currentTarget.value })} />
            </Field>
            <Field id="tn-body-en" label={t("admin_body_en")}>
              <textarea
                id="tn-body-en"
                class="input"
                rows={3}
                value={draft.bodyEn}
                onInput={(e) => patch({ bodyEn: (e.currentTarget as HTMLTextAreaElement).value })}
              />
            </Field>
            <Field id="tn-body-bn" label={t("admin_body_bn")}>
              <textarea
                id="tn-body-bn"
                class="input"
                rows={3}
                value={draft.bodyBn}
                onInput={(e) => patch({ bodyBn: (e.currentTarget as HTMLTextAreaElement).value })}
              />
            </Field>
            <Field id="tn-audience" label={t("admin_audience")} error={problem("batchId")} hint={t("teach_batch_required_hint")}>
              <Select id="tn-audience" value={draft.batchId} onChange={(batchId) => patch({ batchId })} options={batchOptions} />
            </Field>
            <label class="check">
              <input type="checkbox" checked={draft.pinned} onChange={(e) => patch({ pinned: e.currentTarget.checked })} />
              <span>{t("admin_pin_notice")}</span>
            </label>
            {failure && <p class="error-text">{failure}</p>}
            <button class="btn primary block" onClick={save} disabled={busy}>
              {t("save")}
            </button>
            {draft.id && (
              <button
                class="btn danger block"
                disabled={busy}
                onClick={() => setDeleting(list.data?.find((n) => n.id === draft.id) ?? null)}
              >
                {t("admin_delete")}
              </button>
            )}
            <button class="btn quiet block" onClick={close} disabled={busy}>
              {t("cancel")}
            </button>
          </div>
        </Sheet>
      )}

      {deleting && (
        <ConfirmSheet
          title={t("admin_delete_notice_title")}
          body={t("admin_delete_notice_body")}
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
