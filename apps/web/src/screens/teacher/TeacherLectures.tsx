import { useState } from "preact/hooks";
import { t } from "@coaching-app/shared/i18n";
import { extractYouTubeId, LectureUpsert, type LectureSource } from "@coaching-app/shared/schema";
import { ConfirmSheet, Field, Segmented } from "../../components/adminUi";
import { Select } from "../../components/Select";
import { Loading, Sheet } from "../../components/ui";
import { api, ApiError } from "../../lib/api";
import type { AdminChapter, AdminLecture } from "../../lib/adminTypes";
import { extractDriveFileId, isDrivePickerConfigured, openDrivePicker } from "../../lib/drive";
import { errorText, pick, when } from "../../lib/format";
import { isNativeApp } from "../../lib/platform";
import type { TeacherPortal } from "../../lib/types";
import { useSubjects } from "../../lib/queries";
import { useLoad } from "../../lib/useLoad";

type Draft = {
  id: string | null;
  batchId: string;
  chapter: string;
  chapterId: string;
  titleBn: string;
  titleEn: string;
  source: LectureSource;
  youtubeId: string;
  driveFileId: string;
  durationSec: string;
  orderIndex: string;
  isLive: boolean;
  liveAt: string;
  subjectId: string;
  status: "draft" | "published";
  releaseAt: string;
};

const toLocalInput = (unixSec: number | null): string => {
  if (!unixSec) return "";
  const d = new Date(unixSec * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const toUnixSec = (local: string): number | null => (local ? Math.round(new Date(local).getTime() / 1000) : null);

const EMPTY: Draft = {
  id: null,
  batchId: "",
  chapter: "",
  chapterId: "",
  titleBn: "",
  titleEn: "",
  source: "youtube",
  youtubeId: "",
  driveFileId: "",
  durationSec: "",
  orderIndex: "0",
  isLive: false,
  liveAt: "",
  subjectId: "",
  status: "published",
  releaseAt: "",
};

const toDraft = (l: AdminLecture): Draft => ({
  id: l.id,
  batchId: l.batch_id,
  chapter: l.chapter,
  chapterId: l.chapter_id ?? "",
  titleBn: l.title_bn,
  titleEn: l.title_en,
  source: l.source ?? "youtube",
  youtubeId: l.youtube_id,
  driveFileId: l.drive_file_id ?? "",
  durationSec: l.duration_sec ? String(l.duration_sec) : "",
  orderIndex: String(l.order_index),
  isLive: Boolean(l.is_live),
  liveAt: toLocalInput(l.live_at),
  subjectId: l.subject_id ?? "",
  status: l.status ?? "published",
  releaseAt: toLocalInput(l.release_at),
});

export function TeacherLectures() {
  const portal = useLoad(() => api<TeacherPortal>("/api/teacher-application"));
  const batchOptions = (portal.data?.batches ?? []).map((b) => ({ value: b.id, label: pick(b, "title") }));

  const [batchFilter, setBatchFilter] = useState("");
  const list = useLoad(
    () => api<AdminLecture[]>(`/api/teacher/lectures${batchFilter ? `?batchId=${encodeURIComponent(batchFilter)}` : ""}`),
    [batchFilter],
  );
  const subjects = useSubjects();
  const chapters = useLoad(() => api<AdminChapter[]>("/api/teacher/chapters"));
  const [draft, setDraft] = useState<Draft | null>(null);
  const [deleting, setDeleting] = useState<AdminLecture | null>(null);
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
            ? { ...current, driveFileId: picked.id, titleEn: current.titleEn || picked.name, titleBn: current.titleBn || picked.name }
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
    const parsed = LectureUpsert.safeParse({
      batchId: draft.batchId,
      chapter: draft.chapter,
      chapterId: draft.chapterId || null,
      titleBn: draft.titleBn,
      titleEn: draft.titleEn,
      source: draft.source,
      youtubeId: draft.source === "youtube" ? draft.youtubeId.trim() : undefined,
      driveFileId: draft.source === "drive" ? draft.driveFileId.trim() : undefined,
      durationSec: draft.durationSec ? Number.parseInt(draft.durationSec, 10) : undefined,
      orderIndex: Number.parseInt(draft.orderIndex, 10) || 0,
      isLive: draft.isLive,
      liveAt: toUnixSec(draft.liveAt),
      subjectId: draft.subjectId || null,
      status: draft.status,
      releaseAt: toUnixSec(draft.releaseAt),
    });
    if (!parsed.success) {
      setErrors(parsed.error.flatten().fieldErrors);
      return;
    }
    setErrors({});
    setFailure(null);
    setBusy(true);
    try {
      if (draft.id) await api(`/api/teacher/lectures/${draft.id}`, { method: "PUT", body: parsed.data });
      else await api("/api/teacher/lectures", { body: parsed.data });
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
      await api(`/api/teacher/lectures/${deleting.id}`, { method: "DELETE" });
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
        <h1 class="title">{t("teach_tab_lectures")}</h1>
        <button
          class="btn primary"
          onClick={() => setDraft({ ...EMPTY, batchId: batchFilter || (batchOptions[0]?.value ?? "") })}
          disabled={batchOptions.length === 0}
        >
          {t("admin_new_lecture")}
        </button>
      </div>
      {batchOptions.length === 0 && !portal.loading && <p class="muted small">{t("teach_no_batches")}</p>}

      {batchOptions.length > 0 && (
        <div class="field">
          <label for="tl-batch">{t("admin_audience")}</label>
          <Select id="tl-batch" value={batchFilter} onChange={setBatchFilter} options={[{ value: "", label: t("admin_audience_all") }, ...batchOptions]} />
        </div>
      )}

      {list.error && <p class="error-text">{list.error}</p>}
      {list.loading && !list.data && <Loading />}
      {list.data && list.data.length === 0 && <p class="muted small">{t("admin_no_lectures")}</p>}

      <div class="list">
        {(list.data ?? []).map((lecture) => (
          <button class="item" key={lecture.id} onClick={() => setDraft(toDraft(lecture))}>
            <span class="name">{pick(lecture, "title")}</span>
            <span class="meta">
              {lecture.batch_title_en} · {lecture.chapter}
              {lecture.live_at ? ` · ${when(lecture.live_at)}` : ""}
            </span>
            <span class="side">{Boolean(lecture.is_live) && <span class="badge live">{t("live")}</span>}</span>
          </button>
        ))}
      </div>

      {draft && !deleting && (
        <Sheet onClose={busy ? undefined : close}>
          <h2 class="subtitle">{draft.id ? t("admin_edit_lecture") : t("admin_new_lecture")}</h2>
          <div class="stack">
            <Field id="tl-f-batch" label={t("admin_audience")} error={problem("batchId")}>
              <Select id="tl-f-batch" value={draft.batchId} onChange={(batchId) => patch({ batchId })} options={batchOptions} />
            </Field>
            <Field id="tl-chapter" label={t("admin_chapter")} error={problem("chapter")}>
              <input id="tl-chapter" class="input" value={draft.chapter} onInput={(e) => patch({ chapter: e.currentTarget.value })} />
            </Field>
            <Field id="tl-title-en" label={t("admin_title_en")} error={problem("titleEn")}>
              <input id="tl-title-en" class="input" value={draft.titleEn} onInput={(e) => patch({ titleEn: e.currentTarget.value })} />
            </Field>
            <Field id="tl-title-bn" label={t("admin_title_bn")} error={problem("titleBn")}>
              <input id="tl-title-bn" class="input" value={draft.titleBn} onInput={(e) => patch({ titleBn: e.currentTarget.value })} />
            </Field>
            <Field label={t("admin_lecture_source")}>
              <Segmented
                label={t("admin_lecture_source")}
                value={draft.source}
                onChange={(source) => patch({ source })}
                options={[
                  { id: "youtube", label: t("admin_lecture_source_youtube") },
                  { id: "drive", label: t("admin_lecture_source_drive") },
                ]}
              />
            </Field>
            {draft.source === "youtube" ? (
              <Field id="tl-yt" label={t("admin_youtube_id")} error={problem("youtubeId")} hint={t("admin_youtube_id_hint")}>
                <input
                  id="tl-yt"
                  class="input"
                  placeholder={t("admin_youtube_id_placeholder")}
                  value={draft.youtubeId}
                  onInput={(e) => patch({ youtubeId: e.currentTarget.value })}
                />
                {(() => {
                  const previewId = extractYouTubeId(draft.youtubeId);
                  return previewId ? (
                    <img class="youtube-preview" src={`https://i.ytimg.com/vi/${previewId}/mqdefault.jpg`} alt="" width={160} height={90} />
                  ) : (
                    draft.youtubeId.trim() && <p class="hint error-text">{t("admin_youtube_id_invalid")}</p>
                  );
                })()}
              </Field>
            ) : (
              <Field id="tl-drive" label={t("admin_drive_file_id")} error={problem("driveFileId")} hint={t("admin_drive_file_id_hint")}>
                <input
                  id="tl-drive"
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
            )}
            <Field id="tl-chapter-id" label={t("admin_chapter_link")}>
              <Select
                id="tl-chapter-id"
                value={draft.chapterId}
                onChange={(chapterId) => patch({ chapterId })}
                options={[
                  { value: "", label: t("select_none") },
                  ...(chapters.data ?? [])
                    .filter((ch) => ch.batch_id === draft.batchId)
                    .map((ch) => ({ value: ch.id, label: `${pick(ch, "title")} — ${ch.subject_name_en}` })),
                ]}
              />
            </Field>
            <Field id="tl-duration" label={t("admin_duration_min")}>
              <input
                id="tl-duration"
                class="input"
                inputMode="numeric"
                value={draft.durationSec}
                onInput={(e) => patch({ durationSec: e.currentTarget.value.replace(/[^0-9]/g, "") })}
              />
            </Field>
            <Field id="tl-order" label={t("admin_order_index")}>
              <input
                id="tl-order"
                class="input"
                inputMode="numeric"
                value={draft.orderIndex}
                onInput={(e) => patch({ orderIndex: e.currentTarget.value.replace(/[^0-9]/g, "") })}
              />
            </Field>
            <Field id="tl-subject" label={t("admin_lecture_subject")}>
              <Select
                id="tl-subject"
                value={draft.subjectId}
                onChange={(subjectId) => patch({ subjectId })}
                options={[
                  { value: "", label: t("admin_lecture_subject_none") },
                  ...(subjects.data ?? []).map((s) => ({ value: s.id, label: pick(s, "name") })),
                ]}
              />
            </Field>
            <Field id="tl-status" label={t("admin_lecture_status")}>
              <Select
                id="tl-status"
                value={draft.status}
                onChange={(status) => patch({ status: status as "draft" | "published" })}
                options={[
                  { value: "published", label: t("admin_status_published") },
                  { value: "draft", label: t("admin_status_draft") },
                ]}
              />
            </Field>
            {draft.status === "published" && (
              <Field id="tl-release" label={t("admin_release_at")} hint={t("admin_release_hint")}>
                <input id="tl-release" class="input" type="datetime-local" value={draft.releaseAt} onInput={(e) => patch({ releaseAt: e.currentTarget.value })} />
              </Field>
            )}
            <label class="check">
              <input type="checkbox" checked={draft.isLive} onChange={(e) => patch({ isLive: e.currentTarget.checked })} />
              <span>{t("admin_is_live")}</span>
            </label>
            {draft.isLive && (
              <Field id="tl-live-at" label={t("admin_live_at")} hint={t("admin_live_at_hint")}>
                <input id="tl-live-at" class="input" type="datetime-local" value={draft.liveAt} onInput={(e) => patch({ liveAt: e.currentTarget.value })} />
              </Field>
            )}
            {failure && <p class="error-text">{failure}</p>}
            <button class="btn primary block" onClick={save} disabled={busy}>
              {t("save")}
            </button>
            {draft.id && (
              <button class="btn danger block" disabled={busy} onClick={() => setDeleting(list.data?.find((l) => l.id === draft.id) ?? null)}>
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
          title={t("admin_delete_lecture_title")}
          body={t("admin_delete_lecture_body")}
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
