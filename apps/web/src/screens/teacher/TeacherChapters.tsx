import { useState } from "preact/hooks";
import { t } from "@coaching-app/shared/i18n";
import { ChapterUpsert } from "@coaching-app/shared/schema";
import { ConfirmSheet, Field } from "../../components/adminUi";
import { Select } from "../../components/Select";
import { Loading, Sheet } from "../../components/ui";
import { api, ApiError } from "../../lib/api";
import type { AdminChapter } from "../../lib/adminTypes";
import { errorText, pick } from "../../lib/format";
import type { TeacherPortal } from "../../lib/types";
import { useSubjects } from "../../lib/queries";
import { useLoad } from "../../lib/useLoad";

type Draft = { id: string | null; batchId: string; subjectId: string; titleBn: string; titleEn: string; orderIndex: string };

const EMPTY: Draft = { id: null, batchId: "", subjectId: "", titleBn: "", titleEn: "", orderIndex: "0" };

const toDraft = (ch: AdminChapter): Draft => ({
  id: ch.id,
  batchId: ch.batch_id,
  subjectId: ch.subject_id,
  titleBn: ch.title_bn,
  titleEn: ch.title_en,
  orderIndex: String(ch.order_index),
});

export function TeacherChapters() {
  const portal = useLoad(() => api<TeacherPortal>("/api/teacher-application"));
  const batchOptions = (portal.data?.batches ?? []).map((b) => ({ value: b.id, label: pick(b, "title") }));

  const [batchFilter, setBatchFilter] = useState("");
  const list = useLoad(
    () => api<AdminChapter[]>(`/api/teacher/chapters${batchFilter ? `?batchId=${encodeURIComponent(batchFilter)}` : ""}`),
    [batchFilter],
  );
  const subjects = useSubjects();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [deleting, setDeleting] = useState<AdminChapter | null>(null);
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
    const parsed = ChapterUpsert.safeParse({
      batchId: draft.batchId,
      subjectId: draft.subjectId,
      titleBn: draft.titleBn,
      titleEn: draft.titleEn,
      orderIndex: Number.parseInt(draft.orderIndex, 10) || 0,
    });
    if (!parsed.success) {
      setErrors(parsed.error.flatten().fieldErrors);
      return;
    }
    setErrors({});
    setFailure(null);
    setBusy(true);
    try {
      if (draft.id) await api(`/api/teacher/chapters/${draft.id}`, { method: "PUT", body: parsed.data });
      else await api("/api/teacher/chapters", { body: parsed.data });
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
      await api(`/api/teacher/chapters/${deleting.id}`, { method: "DELETE" });
      close();
      await list.reload();
    } catch (e) {
      setFailure(errorText(e instanceof ApiError ? e.code : "network"));
    }
    setBusy(false);
  }

  const patch = (changes: Partial<Draft>) => setDraft((current) => (current ? { ...current, ...changes } : current));
  const problem = (key: string) => errors[key]?.[0];
  const subjectOptions = (subjects.data ?? []).map((s) => ({ value: s.id, label: pick(s, "name") }));

  return (
    <div class="stack">
      <div class="row-between">
        <h1 class="title">{t("admin_tab_chapters")}</h1>
        <button class="btn primary" onClick={() => setDraft({ ...EMPTY, batchId: batchFilter })} disabled={batchOptions.length === 0}>
          {t("admin_new_chapter")}
        </button>
      </div>

      <div class="field">
        <label for="tch-batch">{t("admin_audience")}</label>
        <Select id="tch-batch" value={batchFilter} onChange={setBatchFilter} options={[{ value: "", label: t("admin_audience_all") }, ...batchOptions]} />
      </div>

      {list.error && <p class="error-text">{list.error}</p>}
      {list.loading && !list.data && <Loading />}
      {list.data && list.data.length === 0 && <p class="muted small">{t("admin_no_chapters")}</p>}

      <div class="list">
        {(list.data ?? []).map((chapter) => (
          <button class="item" key={chapter.id} onClick={() => setDraft(toDraft(chapter))}>
            <span class="name">{pick(chapter, "title")}</span>
            <span class="meta">
              {chapter.batch_title_en} · {chapter.subject_name_en}
            </span>
          </button>
        ))}
      </div>

      {draft && !deleting && (
        <Sheet onClose={busy ? undefined : close}>
          <h2 class="subtitle">{draft.id ? t("admin_edit_chapter") : t("admin_new_chapter")}</h2>
          <div class="stack">
            <Field id="tch-batch-f" label={t("admin_audience")} error={problem("batchId")}>
              <Select id="tch-batch-f" value={draft.batchId} onChange={(batchId) => patch({ batchId })} options={batchOptions} />
            </Field>
            <Field id="tch-subject" label={t("admin_lecture_subject")} error={problem("subjectId")}>
              <Select
                id="tch-subject"
                value={draft.subjectId}
                onChange={(subjectId) => patch({ subjectId })}
                options={[{ value: "", label: t("select_none") }, ...subjectOptions]}
              />
            </Field>
            <Field id="tch-title-en" label={t("admin_title_en")} error={problem("titleEn")}>
              <input id="tch-title-en" class="input" value={draft.titleEn} onInput={(e) => patch({ titleEn: e.currentTarget.value })} />
            </Field>
            <Field id="tch-title-bn" label={t("admin_title_bn")} error={problem("titleBn")}>
              <input id="tch-title-bn" class="input" value={draft.titleBn} onInput={(e) => patch({ titleBn: e.currentTarget.value })} />
            </Field>
            <Field id="tch-order" label={t("admin_order_index")}>
              <input
                id="tch-order"
                class="input"
                inputMode="numeric"
                value={draft.orderIndex}
                onInput={(e) => patch({ orderIndex: e.currentTarget.value.replace(/[^0-9]/g, "") })}
              />
            </Field>
            {failure && <p class="error-text">{failure}</p>}
            <button class="btn primary block" onClick={save} disabled={busy}>
              {t("save")}
            </button>
            {draft.id && (
              <button class="btn danger block" disabled={busy} onClick={() => setDeleting(list.data?.find((ch) => ch.id === draft.id) ?? null)}>
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
          title={t("admin_delete_chapter_title")}
          body={t("admin_delete_chapter_body")}
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
