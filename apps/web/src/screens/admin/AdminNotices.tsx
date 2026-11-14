import { useState } from "preact/hooks";
import { t } from "@coaching-app/shared/i18n";
import { NoticeUpsert } from "@coaching-app/shared/schema";
import { ConfirmSheet, Field } from "../../components/adminUi";
import { Select } from "../../components/Select";
import { Loading, Sheet } from "../../components/ui";
import { api, ApiError } from "../../lib/api";
import type { AdminBatchRow, AdminNotice } from "../../lib/adminTypes";
import { errorText, pick, when } from "../../lib/format";
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

export function AdminNotices() {
  const list = useLoad(() => api<AdminNotice[]>("/api/admin/notices"));
  const batches = useLoad(() => api<AdminBatchRow[]>("/api/admin/batches"));
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
      batchId: draft.batchId || null,
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
      if (draft.id) await api(`/api/admin/notices/${draft.id}`, { method: "PUT", body: parsed.data });
      else await api("/api/admin/notices", { body: parsed.data });
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
      await api(`/api/admin/notices/${deleting.id}`, { method: "DELETE" });
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
        <h1 class="title">{t("admin_tab_notices")}</h1>
        <button class="btn primary" onClick={() => setDraft(EMPTY)}>
          {t("admin_new_notice")}
        </button>
      </div>

      {list.error && <p class="error-text">{list.error}</p>}
      {list.loading && !list.data && <Loading />}
      {list.data && list.data.length === 0 && <p class="muted small">{t("no_notices")}</p>}

      <div class="list">
        {(list.data ?? []).map((notice) => (
          <button class="item" key={notice.id} onClick={() => setDraft(toDraft(notice))}>
            <span class="name">{pick(notice, "title")}</span>
            <span class="meta">
              {notice.batch_title_en ?? t("admin_audience_all")} · {when(notice.created_at)}
            </span>
            <span class="side">{notice.pinned ? <span class="badge live">{t("admin_pinned")}</span> : null}</span>
          </button>
        ))}
      </div>

      {draft && !deleting && (
        <Sheet onClose={busy ? undefined : close}>
          <h2 class="subtitle">{draft.id ? t("admin_edit_notice") : t("admin_new_notice")}</h2>
          <div class="stack">
            <Field id="n-title-en" label={t("admin_title_en")} error={problem("titleEn")}>
              <input id="n-title-en" class="input" value={draft.titleEn} onInput={(e) => patch({ titleEn: e.currentTarget.value })} />
            </Field>
            <Field id="n-title-bn" label={t("admin_title_bn")} error={problem("titleBn")}>
              <input id="n-title-bn" class="input" value={draft.titleBn} onInput={(e) => patch({ titleBn: e.currentTarget.value })} />
            </Field>
            <Field id="n-body-en" label={t("admin_body_en")}>
              <textarea
                id="n-body-en"
                class="input"
                rows={3}
                value={draft.bodyEn}
                onInput={(e) => patch({ bodyEn: (e.currentTarget as HTMLTextAreaElement).value })}
              />
            </Field>
            <Field id="n-body-bn" label={t("admin_body_bn")}>
              <textarea
                id="n-body-bn"
                class="input"
                rows={3}
                value={draft.bodyBn}
                onInput={(e) => patch({ bodyBn: (e.currentTarget as HTMLTextAreaElement).value })}
              />
            </Field>
            <Field id="n-audience" label={t("admin_audience")}>
              <Select
                id="n-audience"
                value={draft.batchId}
                onChange={(batchId) => patch({ batchId })}
                options={[
                  { value: "", label: t("admin_audience_all") },
                  ...(batches.data ?? []).map((b) => ({ value: b.id, label: pick(b, "title") })),
                ]}
              />
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
