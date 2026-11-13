import { useEffect, useState } from "preact/hooks";
import { t } from "@coaching-app/shared/i18n";
import { Loading, SectionHead, Sheet } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { errorText, when } from "../lib/format";
import type { AdminTeacher, AdminTeacherApplication } from "../lib/types";

const subjectList = (subjects: string[] | null) =>
  subjects && subjects.length > 0 ? subjects.map((s) => t(`subject_${s}`)).join(", ") : "—";

export function AdminTeachers() {
  const [applications, setApplications] = useState<AdminTeacherApplication[] | null>(null);
  const [teachers, setTeachers] = useState<AdminTeacher[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<AdminTeacherApplication | null>(null);
  const [suspending, setSuspending] = useState<AdminTeacher | null>(null);
  const [note, setNote] = useState("");

  async function load() {
    try {
      const [pending, active] = await Promise.all([
        api<AdminTeacherApplication[]>("/api/admin/teacher-applications"),
        api<AdminTeacher[]>("/api/admin/teachers"),
      ]);
      setApplications(pending);
      setTeachers(active);
    } catch (e) {
      setError(errorText(e instanceof ApiError ? e.code : "network"));
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function run(uid: string, action: () => Promise<unknown>) {
    setBusyUid(uid);
    setError(null);
    try {
      await action();
      setRejecting(null);
      setSuspending(null);
      setNote("");
    } catch (e) {
      setError(errorText(e instanceof ApiError ? e.code : "network"));
    }
    await load();
    setBusyUid(null);
  }

  const review = (application: AdminTeacherApplication, decision: "approved" | "rejected", text?: string) =>
    run(application.uid, () =>
      api("/api/admin/teacher-applications/review", {
        body: { uid: application.uid, decision, note: text || undefined },
      }),
    );

  const suspend = (teacher: AdminTeacher) =>
    run(teacher.uid, () => api(`/api/admin/teachers/${teacher.uid}/suspend`, { method: "POST", body: {} }));

  if (!applications || !teachers) {
    return error ? <p class="error-text">{error}</p> : <Loading />;
  }

  return (
    <>
      {error && <p class="error-text">{error}</p>}

      <section class="stack">
        <SectionHead title={t("admin_teachers_pending")} />
        {applications.length === 0 ? (
          <p class="muted small">{t("admin_teachers_none")}</p>
        ) : (
          applications.map((application) => (
            <div class="panel" key={application.uid}>
              <div class="stack" style="gap:2px">
                <strong>{application.name}</strong>
                <span class="small muted">
                  {subjectList(application.subjects)} · {t("admin_experience", { years: application.experience_years })} ·{" "}
                  {when(application.created_at)}
                </span>
                <span class="small">
                  {application.qualification} · {application.phone}
                </span>
              </div>
              <p class="small" style="white-space:pre-wrap">
                {application.bio}
              </p>
              {application.demo_url && (
                <a class="small" href={application.demo_url} target="_blank" rel="noopener noreferrer">
                  {t("admin_demo")}
                </a>
              )}
              <div class="runner-actions">
                <button class="btn danger" onClick={() => setRejecting(application)} disabled={busyUid === application.uid}>
                  {t("admin_reject")}
                </button>
                <button class="btn primary" onClick={() => review(application, "approved")} disabled={busyUid === application.uid}>
                  {t("admin_approve")}
                </button>
              </div>
            </div>
          ))
        )}
      </section>

      <section class="stack">
        <SectionHead title={t("admin_teachers_active")} />
        {teachers.length === 0 ? (
          <p class="muted small">{t("admin_teachers_active_none")}</p>
        ) : (
          <div class="list">
            {teachers.map((teacher) => (
              <div class="item" key={teacher.uid}>
                <span class="name">{teacher.name}</span>
                <span class="meta">
                  {subjectList(teacher.subjects)} · {t("admin_batches_count", { count: teacher.batch_count })}
                </span>
                <span class="side">
                  <button class="btn small danger" onClick={() => setSuspending(teacher)} disabled={busyUid === teacher.uid}>
                    {t("admin_suspend")}
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {rejecting && (
        <Sheet onClose={busyUid ? undefined : () => setRejecting(null)}>
          <h2 class="subtitle">{t("admin_reject_app_title")}</h2>
          <div class="field">
            <label for="app-note">{t("admin_reject_note")}</label>
            <textarea
              id="app-note"
              class="input"
              rows={3}
              maxLength={300}
              value={note}
              onInput={(e) => setNote((e.currentTarget as HTMLTextAreaElement).value)}
            />
          </div>
          <button class="btn danger block" onClick={() => review(rejecting, "rejected", note.trim())} disabled={busyUid === rejecting.uid}>
            {t("admin_confirm_reject_app")}
          </button>
          <button class="btn quiet block" onClick={() => setRejecting(null)} disabled={busyUid === rejecting.uid}>
            {t("cancel")}
          </button>
        </Sheet>
      )}

      {suspending && (
        <Sheet onClose={busyUid ? undefined : () => setSuspending(null)}>
          <h2 class="subtitle">{t("admin_confirm_suspend_title")}</h2>
          <p class="muted">{t("admin_confirm_suspend_body", { name: suspending.name })}</p>
          <button class="btn danger block" onClick={() => suspend(suspending)} disabled={busyUid === suspending.uid}>
            {t("admin_confirm_go")}
          </button>
          <button class="btn quiet block" onClick={() => setSuspending(null)} disabled={busyUid === suspending.uid}>
            {t("cancel")}
          </button>
        </Sheet>
      )}
    </>
  );
}
