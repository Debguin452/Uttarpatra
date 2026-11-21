import { useState } from "preact/hooks";
import { t } from "@coaching-app/shared/i18n";
import { NoteUpsert } from "@coaching-app/shared/schema";
import { ConfirmSheet, Field, Segmented } from "../../components/adminUi";
import { Select } from "../../components/Select";
import { Loading, Sheet } from "../../components/ui";
import { api, ApiError } from "../../lib/api";
import type { AdminNote } from "../../lib/adminTypes";
import { extractDriveFileId, isDrivePickerConfigured, openDrivePicker } from "../../lib/drive";
import { errorText, pick, when } from "../../lib/format";
import { isNativeApp } from "../../lib/platform";
import type { TeacherPortal } from "../../lib/types";
import { useLoad } from "../../lib/useLoad";

type Draft = {
  id: string | null;
  batchId: string;
  lectureId: string;
  titleBn: string;
  titleEn: string;
  driveFileId: string;
  kind: "note" | "dpp" | "flashcard" | "formula";
  isFree: boolean;
};

const EMPTY: Draft = { id: null, batchId: "", lectureId: "", titleBn: "", titleEn: "", driveFileId: "", kind: "note", isFree: false };

const toDraft = (n: AdminNote): Draft => ({
  id: n.id,
  batchId: n.batch_id ?? "",
  lectureId: n.lecture_id ?? "",
  titleBn: n.title_bn,
  titleEn: n.title_en,
  driveFileId: n.drive_file_id,
  kind: n.kind,
  isFree: Boolean(n.is_free),
});

export function TeacherMaterials() {
  const portal = useLoad(() => api<TeacherPortal>("/api/teacher-application"));
  const batchOptions = (portal.data?.batches ?? []).map((b) => ({ value: b.id, label: pick(b, "title") }));

  const [batchFilter, setBatchFilter] = useState("");
  const list = useLoad(
    () => api<AdminNote[]>(`/api/teacher/materials${batchFilter ? `?batchId=${encodeURIComponent(batchFilter)}` : ""}`),
    [batchFilter],
  );
  const [draft, setDraft] = useState<Draft | null>(null);
  const [deleting, setDeleting] = useState<AdminNote | null>(null);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const showPicker = isDrivePickerConfigured() && !isNativeApp();

  const close = () => {
    setDraft(null);
    setDeleting(null);
    setErrors({});
    setFailure(null);
  };

  async function pickFromDrive() {
    setPicking(true);
    setFailure(null);
    try {
      const picked = await openDrivePicker();
      if (picked) {
        setDraft((current) =>
          current
            ? {
                ...current,
                driveFileId: picked.id,
                titleEn: current.titleEn || picked.name,
                titleBn: current.titleBn || picked.name,
              }
            : current,
        );
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("drive picker failed", e);
      setFailure(t("drive_picker_failed"));
    }
    setPicking(false);
  }

  async function save() {
    if (!draft) return;
    const parsed = NoteUpsert.safeParse({
      batchId: draft.batchId,
      lectureId: draft.lectureId.trim() || undefined,
      titleBn: draft.titleBn,
      titleEn: draft.titleEn,
      driveFileId: draft.driveFileId.trim(),
      kind: draft.kind,
      isFree: draft.isFree,
    });
    if (!parsed.success) {
      setErrors(parsed.error.flatten().fieldErrors);
      return;
    }
    setErrors({});
    setFailure(null);
    setBusy(true);
    try {
      if (draft.id) await api(`/api/teacher/materials/${draft.id}`, { method: "PUT", body: parsed.data });
      else await api("/api/teacher/materials", { body: parsed.data });
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
      await api(`/api/teacher/materials/${deleting.id}`, { method: "DELETE" });
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
        <h1 class="title">{t("teach_tab_materials")}</h1>
        <button
          class="btn primary"
          onClick={() => setDraft({ ...EMPTY, batchId: batchFilter || (batchOptions[0]?.value ?? "") })}
          disabled={batchOptions.length === 0}
        >
          {t("admin_new_material")}
        </button>
      </div>
      {batchOptions.length === 0 && !portal.loading && <p class="muted small">{t("teach_no_batches")}</p>}

      {batchOptions.length > 0 && (
        <div class="field">
          <label for="tm-batch">{t("admin_audience")}</label>
          <Select id="tm-batch" value={batchFilter} onChange={setBatchFilter} options={[{ value: "", label: t("admin_audience_all") }, ...batchOptions]} />
        </div>
      )}

      {list.error && <p class="error-text">{list.error}</p>}
      {list.loading && !list.data && <Loading />}
      {list.data && list.data.length === 0 && <p class="muted small">{t("no_materials")}</p>}

      <div class="list">
        {(list.data ?? []).map((note) => (
          <button class="item" key={note.id} onClick={() => setDraft(toDraft(note))}>
            <span class="name">{pick(note, "title")}</span>
            <span class="meta">
              {note.batch_title_en} · {t(`material_${note.kind}`)} · {when(note.created_at)}
            </span>
            <span class="side">{Boolean(note.is_free) && <span class="badge mark">{t("free")}</span>}</span>
          </button>
        ))}
      </div>

      {draft && !deleting && (
        <Sheet onClose={busy ? undefined : close}>
          <h2 class="subtitle">{draft.id ? t("admin_edit_material") : t("admin_new_material")}</h2>
          <div class="stack">
            <Field id="tm-title-en" label={t("admin_title_en")} error={problem("titleEn")}>
              <input id="tm-title-en" class="input" value={draft.titleEn} onInput={(e) => patch({ titleEn: e.currentTarget.value })} />
            </Field>
            <Field id="tm-title-bn" label={t("admin_title_bn")} error={problem("titleBn")}>
              <input id="tm-title-bn" class="input" value={draft.titleBn} onInput={(e) => patch({ titleBn: e.currentTarget.value })} />
            </Field>
            <Field id="tm-f-batch" label={t("admin_audience")} error={problem("batchId")}>
              <Select id="tm-f-batch" value={draft.batchId} onChange={(batchId) => patch({ batchId })} options={batchOptions} />
            </Field>
            <Field id="tm-lecture" label={t("admin_lecture_id")} hint={t("admin_lecture_id_hint")}>
              <input id="tm-lecture" class="input" value={draft.lectureId} onInput={(e) => patch({ lectureId: e.currentTarget.value })} />
            </Field>
            <Field id="tm-drive" label={t("admin_drive_file_id")} error={problem("driveFileId")} hint={t("admin_drive_file_id_hint")}>
              <input
                id="tm-drive"
                class="input"
                value={draft.driveFileId}
                onInput={(e) => patch({ driveFileId: e.currentTarget.value })}
                onBlur={(e) => patch({ driveFileId: extractDriveFileId(e.currentTarget.value) })}
              />
              {showPicker && (
                <button type="button" class="btn quiet" onClick={pickFromDrive} disabled={picking}>
                  {picking ? t("drive_picker_opening") : t("drive_picker_choose")}
                </button>
              )}
            </Field>
            <Field label={t("admin_material_kind")}>
              <Segmented
                label={t("admin_material_kind")}
                value={draft.kind}
                onChange={(kind) => patch({ kind })}
                options={[
                  { id: "note", label: t("material_note") },
                  { id: "dpp", label: t("material_dpp") },
                  { id: "flashcard", label: t("material_flashcard") },
                  { id: "formula", label: t("material_formula") },
                ]}
              />
            </Field>
            <label class="check">
              <input type="checkbox" checked={draft.isFree} onChange={(e) => patch({ isFree: e.currentTarget.checked })} />
              <span>{t("admin_material_free")}</span>
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
          title={t("admin_delete_material_title")}
          body={t("admin_delete_material_body")}
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
