import { useState } from "preact/hooks";
import { t } from "@coaching-app/shared/i18n";
import { BatchUpsert, TRACKS, type Track } from "@coaching-app/shared/schema";
import { AdminImagePreview } from "../../components/AdminImagePreview";
import { Field, Segmented } from "../../components/adminUi";
import { Select } from "../../components/Select";
import { Loading, SectionHead } from "../../components/ui";
import { api, ApiError } from "../../lib/api";
import type { AdminBatchDetail, AdminBatchRow, BatchStatus } from "../../lib/adminTypes";
import { errorText, money, pick } from "../../lib/format";
import { imageSrc } from "../../lib/image";
import { useSubjects } from "../../lib/queries";
import { go } from "../../lib/router";
import { currentRole } from "../../lib/session";
import { subjectName } from "../../lib/subjects";
import type { AdminTeacher } from "../../lib/types";
import { useLoad } from "../../lib/useLoad";

const STATUSES = ["all", "draft", "published", "archived"] as const;
type StatusFilter = (typeof STATUSES)[number];

const statusBadge = (status: BatchStatus) =>
  status === "published" ? "badge mark" : status === "archived" ? "badge error" : "badge";

export function AdminBatches() {
  const canWrite = currentRole() === "super_admin";
  const list = useLoad(() => api<AdminBatchRow[]>("/api/admin/batches"));
  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");

  const needle = search.trim().toLowerCase();
  const rows = (list.data ?? []).filter(
    (b) =>
      (status === "all" || b.status === status) &&
      (!needle || b.title_en.toLowerCase().includes(needle) || b.title_bn.includes(search.trim()) || b.id.includes(needle)),
  );

  return (
    <div class="stack">
      <div class="row-between">
        <h1 class="title">{t("admin_tab_batches")}</h1>
        {canWrite && (
          <button class="btn primary" onClick={() => go("admin/batches/new")}>
            {t("admin_new_batch")}
          </button>
        )}
      </div>

      <div class="chips" role="group">
        {STATUSES.map((s) => (
          <button class="chip" aria-pressed={status === s} onClick={() => setStatus(s)}>
            {s === "all" ? t("filter_all") : t(`batch_status_${s}`)}
          </button>
        ))}
      </div>
      <input
        class="input"
        type="search"
        placeholder={t("admin_batch_search")}
        value={search}
        onInput={(e) => setSearch(e.currentTarget.value)}
      />

      {list.error && <p class="error-text">{list.error}</p>}
      {list.loading && !list.data && <Loading />}
      {list.data && rows.length === 0 && <p class="muted small">{t("no_batches")}</p>}

      <div class="list">
        {rows.map((b) => (
          <button class="item" key={b.id} onClick={() => go(`admin/batches/${b.id}`)}>
            <span class="name">{pick(b, "title")}</span>
            <span class="meta">
              {t(`filter_${b.track}`)} · {b.kind === "free" ? t("free") : money(b.price_paise)} ·{" "}
              {t("admin_batch_counts", { students: b.enrollment_count, teachers: b.teacher_count })}
            </span>
            <span class="side">
              <span class={statusBadge(b.status)}>{t(`batch_status_${b.status}`)}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

type FormState = {
  id: string;
  titleBn: string;
  titleEn: string;
  track: Track;
  kind: "paid" | "free";
  price: string;
  summaryBn: string;
  summaryEn: string;
  video: string;
  banner: string;
  status: BatchStatus;
};

const BLANK: FormState = {
  id: "",
  titleBn: "",
  titleEn: "",
  track: "neet",
  kind: "paid",
  price: "",
  summaryBn: "",
  summaryEn: "",
  video: "",
  banner: "",
  status: "draft",
};

function fromBatch(b: AdminBatchDetail["batch"]): FormState {
  return {
    id: b.id,
    titleBn: b.title_bn,
    titleEn: b.title_en,
    track: b.track,
    kind: b.kind,
    price: b.kind === "free" ? "" : String(b.price_paise / 100),
    summaryBn: b.summary_bn ?? "",
    summaryEn: b.summary_en ?? "",
    video: b.preview_video_id ?? "",
    banner: b.banner_url ?? "",
    status: b.status,
  };
}

const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

export function extractVideoId(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  if (/^[A-Za-z0-9_-]{11}$/.test(value)) return value;
  const match = value.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
  return match?.[1] ?? null;
}

function TeacherPanel({
  batchId,
  teachers,
  canWrite,
  onChanged,
}: {
  batchId: string;
  teachers: AdminBatchDetail["teachers"];
  canWrite: boolean;
  onChanged: () => void;
}) {
  const subjects = useSubjects();
  const pool = useLoad(() => (canWrite ? api<AdminTeacher[]>("/api/admin/teachers") : Promise.resolve([])), [canWrite]);
  const [teacherUid, setTeacherUid] = useState("");
  const [subject, setSubject] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const assigned = new Set(teachers.map((x) => x.uid));
  const candidates = (pool.data ?? []).filter((x) => !assigned.has(x.uid));
  const activeSubjects = (subjects.data ?? []).filter((s) => s.active);

  async function run(key: string, action: () => Promise<unknown>) {
    setBusy(key);
    setFailure(null);
    try {
      await action();
      setTeacherUid("");
      setSubject("");
      onChanged();
    } catch (e) {
      setFailure(errorText(e instanceof ApiError ? e.code : "network"));
    }
    setBusy(null);
  }

  return (
    <section class="stack">
      <SectionHead title={t("admin_batch_teachers")} />
      {teachers.length === 0 ? (
        <p class="muted small">{t("teach_no_batches_teacher")}</p>
      ) : (
        <div class="list">
          {teachers.map((teacher) => (
            <div class="item" key={teacher.uid}>
              <span class="name">{teacher.name}</span>
              <span class="meta">{teacher.subject ? subjectName(subjects.data, teacher.subject) : t("admin_no_subject")}</span>
              {canWrite && (
                <span class="side">
                  <button
                    class="btn small quiet"
                    disabled={busy === teacher.uid}
                    onClick={() =>
                      run(teacher.uid, () => api(`/api/admin/batches/${batchId}/teachers/${teacher.uid}`, { method: "DELETE" }))
                    }
                  >
                    {t("admin_remove")}
                  </button>
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {canWrite && (
        <div class="panel">
          <div class="form-grid">
            <Field id="assign-teacher" label={t("admin_pick_teacher")}>
              <Select
                id="assign-teacher"
                value={teacherUid}
                onChange={setTeacherUid}
                placeholder={t("admin_pick_teacher")}
                options={candidates.map((candidate) => ({ value: candidate.uid, label: candidate.name }))}
              />
            </Field>
            <Field id="assign-subject" label={t("admin_pick_subject")}>
              <Select
                id="assign-subject"
                value={subject}
                onChange={setSubject}
                options={[
                  { value: "", label: t("select_none") },
                  ...activeSubjects.map((s) => ({ value: s.id, label: pick(s, "name") })),
                ]}
              />
            </Field>
          </div>
          {candidates.length === 0 && !pool.loading && <p class="hint">{t("admin_no_teachers_available")}</p>}
          {failure && <p class="error-text">{failure}</p>}
          <button
            class="btn"
            disabled={!teacherUid || busy === "add"}
            onClick={() =>
              run("add", () =>
                api(`/api/admin/batches/${batchId}/teachers`, { body: { uid: teacherUid, subject: subject || undefined } }),
              )
            }
          >
            {t("admin_assign_teacher")}
          </button>
        </div>
      )}
    </section>
  );
}

function BatchForm({
  initial,
  isNew,
  teachers,
  canWrite,
  onSaved,
}: {
  initial: FormState;
  isNew: boolean;
  teachers: AdminBatchDetail["teachers"];
  canWrite: boolean;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>(initial);
  const [idTouched, setIdTouched] = useState(!isNew);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const patch = (changes: Partial<FormState>) => {
    setSaved(false);
    setForm((current) => ({ ...current, ...changes }));
  };

  const problem = (key: string) => errors[key]?.[0];

  async function save(event: Event) {
    event.preventDefault();
    setSaved(false);
    setFailure(null);

    const videoId = extractVideoId(form.video);
    if (form.video.trim() && !videoId) {
      setErrors({ previewVideoId: [t("admin_video_invalid")] });
      return;
    }

    const parsed = BatchUpsert.safeParse({
      id: form.id.trim(),
      titleBn: form.titleBn,
      titleEn: form.titleEn,
      track: form.track,
      kind: form.kind,
      pricePaise: form.kind === "free" ? 0 : Math.round((Number.parseFloat(form.price) || 0) * 100),
      summaryBn: form.summaryBn.trim() || undefined,
      summaryEn: form.summaryEn.trim() || undefined,
      previewVideoId: videoId ?? undefined,
      bannerUrl: form.banner.trim() ? imageSrc(form.banner) : undefined,
      status: form.status,
    });
    if (!parsed.success) {
      setErrors(parsed.error.flatten().fieldErrors);
      return;
    }

    setErrors({});
    setBusy(true);
    try {
      if (isNew) {
        await api("/api/admin/batches", { body: parsed.data });
        go(`admin/batches/${parsed.data.id}`);
        return;
      }
      await api(`/api/admin/batches/${parsed.data.id}`, { method: "PUT", body: parsed.data });
      setSaved(true);
      onSaved();
    } catch (e) {
      setFailure(errorText(e instanceof ApiError ? e.code : "network"));
    }
    setBusy(false);
  }


  return (
    <>
      <form class="stack" onSubmit={save}>
        <fieldset disabled={!canWrite} class="stack">
          <SectionHead title={t("admin_section_basics")} />
          <div class="form-grid">
            <Field id="title-en" label={t("admin_title_en")} error={problem("titleEn")}>
              <input
                id="title-en"
                class="input"
                value={form.titleEn}
                onInput={(e) => {
                  const titleEn = e.currentTarget.value;
                  patch(idTouched ? { titleEn } : { titleEn, id: slugify(titleEn) });
                }}
              />
            </Field>
            <Field id="title-bn" label={t("admin_title_bn")} error={problem("titleBn")}>
              <input id="title-bn" class="input" value={form.titleBn} onInput={(e) => patch({ titleBn: e.currentTarget.value })} />
            </Field>
            <Field
              id="batch-id"
              label={t("admin_batch_id")}
              hint={isNew ? t("admin_batch_id_hint") : t("admin_batch_id_locked")}
              error={problem("id")}
            >
              <input
                id="batch-id"
                class="input"
                value={form.id}
                disabled={!isNew}
                onInput={(e) => {
                  setIdTouched(true);
                  patch({ id: e.currentTarget.value.toLowerCase() });
                }}
              />
            </Field>
            <Field id="track" label={t("admin_track")} error={problem("track")}>
              <Select
                id="track"
                value={form.track}
                onChange={(track) => patch({ track: track as Track })}
                options={TRACKS.map((track) => ({
                  value: track,
                  label: t(`filter_${track}`),
                  group: track.startsWith("class") ? t("admin_group_school") : t("admin_group_competitive"),
                }))}
              />
            </Field>
          </div>

          <SectionHead title={t("admin_section_pricing")} />
          <div class="form-grid">
            <Field label={t("admin_access")}>
              <Segmented
                label={t("admin_access")}
                value={form.kind}
                onChange={(kind) => patch({ kind })}
                options={[
                  { id: "paid", label: t("admin_kind_paid") },
                  { id: "free", label: t("free") },
                ]}
              />
            </Field>
            <Field id="price" label={t("admin_price_rupees")} error={problem("pricePaise")}>
              <input
                id="price"
                class="input"
                inputMode="decimal"
                disabled={form.kind === "free"}
                value={form.kind === "free" ? "" : form.price}
                onInput={(e) => patch({ price: e.currentTarget.value.replace(/[^0-9.]/g, "") })}
              />
            </Field>
            <Field label={t("admin_visibility")} hint={t(`batch_status_hint_${form.status}`)} span>
              <Segmented
                label={t("admin_visibility")}
                value={form.status}
                onChange={(status) => patch({ status })}
                options={[
                  { id: "draft", label: t("batch_status_draft") },
                  { id: "published", label: t("batch_status_published") },
                  { id: "archived", label: t("batch_status_archived") },
                ]}
              />
            </Field>
          </div>
          {!isNew && form.status === "published" && teachers.length === 0 && (
            <p class="notice pinned small">{t("admin_warn_no_teacher")}</p>
          )}

          <SectionHead title={t("admin_section_description")} />
          <div class="form-grid">
            <Field id="summary-en" label={t("admin_summary_en")}>
              <textarea
                id="summary-en"
                class="input"
                rows={4}
                value={form.summaryEn}
                onInput={(e) => patch({ summaryEn: (e.currentTarget as HTMLTextAreaElement).value })}
              />
            </Field>
            <Field id="summary-bn" label={t("admin_summary_bn")}>
              <textarea
                id="summary-bn"
                class="input"
                rows={4}
                value={form.summaryBn}
                onInput={(e) => patch({ summaryBn: (e.currentTarget as HTMLTextAreaElement).value })}
              />
            </Field>
            <Field id="banner" label={t("admin_batch_banner")} hint={t("admin_batch_banner_hint")} error={problem("bannerUrl")} span>
              <input id="banner" class="input" inputMode="url" placeholder="https://" value={form.banner} onInput={(e) => patch({ banner: e.currentTarget.value })} />
            </Field>
            <div class="span"><AdminImagePreview url={form.banner} /></div>
            <Field id="video" label={t("admin_preview_video")} hint={t("admin_preview_video_hint")} error={problem("previewVideoId")} span>
              <input id="video" class="input" value={form.video} onInput={(e) => patch({ video: e.currentTarget.value })} />
            </Field>
          </div>
        </fieldset>

        {failure && <p class="error-text">{failure}</p>}
        {saved && <p class="notice small">{t("admin_saved")}</p>}
        {canWrite && (
          <button class="btn primary" type="submit" disabled={busy}>
            {isNew ? t("admin_create_batch") : t("save")}
          </button>
        )}
      </form>

      {!isNew && <TeacherPanel batchId={form.id} teachers={teachers} canWrite={canWrite} onChanged={onSaved} />}
    </>
  );
}

export function AdminBatchEditor({ id }: { id: string }) {
  const isNew = id === "new";
  const canWrite = currentRole() === "super_admin";
  const detail = useLoad(() => (isNew ? Promise.resolve(null) : api<AdminBatchDetail>(`/api/admin/batches/${id}`)), [id]);

  return (
    <div class="stack">
      <div class="row-between">
        <h1 class="title">{isNew ? t("admin_new_batch") : t("admin_edit_batch")}</h1>
        <button class="btn small quiet" onClick={() => go("admin/batches")}>
          {t("back")}
        </button>
      </div>
      {detail.error && <p class="error-text">{detail.error}</p>}
      {detail.loading && !detail.data && !isNew && <Loading />}
      {(isNew || detail.data) && (
        <BatchForm
          key={id}
          initial={isNew ? BLANK : fromBatch(detail.data!.batch)}
          isNew={isNew}
          teachers={detail.data?.teachers ?? []}
          canWrite={canWrite}
          onSaved={detail.reload}
        />
      )}
    </div>
  );
}
