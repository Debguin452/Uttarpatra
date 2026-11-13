import { useEffect, useState } from "preact/hooks";
import { t } from "@coaching-app/shared/i18n";
import { Subject, TeacherApplication } from "@coaching-app/shared/schema";
import { Loading } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { errorText, pick, when } from "../lib/format";
import { go } from "../lib/router";
import { clearSignupIntent } from "../lib/onboarding";
import { loadMe, me } from "../lib/session";
import type { TeacherApplicationView, TeacherPortal } from "../lib/types";

const SUBJECTS = Subject.options;

function ApplicationForm({
  initial,
  submitLabel,
  onSaved,
}: {
  initial: TeacherApplicationView | null;
  submitLabel: string;
  onSaved: () => void;
}) {
  const profilePhone = me.value && me.value.registered ? (me.value.user.phone ?? "") : "";
  const [subjects, setSubjects] = useState<string[]>(initial?.subjects ?? []);
  const [qualification, setQualification] = useState(initial?.qualification ?? "");
  const [experience, setExperience] = useState(String(initial?.experience_years ?? ""));
  const [phone, setPhone] = useState(initial?.phone ?? profilePhone);
  const [bio, setBio] = useState(initial?.bio ?? "");
  const [demo, setDemo] = useState(initial?.demo_url ?? "");
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const toggle = (subject: string) =>
    setSubjects((current) => (current.includes(subject) ? current.filter((s) => s !== subject) : [...current, subject]));

  async function submit(event: Event) {
    event.preventDefault();
    const parsed = TeacherApplication.safeParse({
      subjects,
      qualification,
      experienceYears: experience === "" ? undefined : Number(experience),
      phone,
      bio,
      demoUrl: demo.trim() || undefined,
    });
    if (!parsed.success) {
      setErrors(parsed.error.flatten().fieldErrors);
      return;
    }
    setErrors({});
    setFailure(null);
    setBusy(true);
    try {
      await api("/api/teacher-application", { method: "PUT", body: parsed.data });
      onSaved();
    } catch (e) {
      setFailure(errorText(e instanceof ApiError ? e.code : "network"));
      setBusy(false);
    }
  }

  const problem = (key: string) => errors[key]?.[0];

  return (
    <form class="stack" onSubmit={submit}>
      <div class="field">
        <label>{t("teach_subjects")}</label>
        <div class="chips" role="group">
          {SUBJECTS.map((subject) => (
            <button type="button" class="chip" aria-pressed={subjects.includes(subject)} onClick={() => toggle(subject)}>
              {t(`subject_${subject}`)}
            </button>
          ))}
        </div>
        {problem("subjects") && <span class="error-text">{problem("subjects")}</span>}
      </div>
      <div class="field">
        <label for="qualification">{t("teach_qualification")}</label>
        <input id="qualification" class="input" value={qualification} onInput={(e) => setQualification(e.currentTarget.value)} />
        {problem("qualification") && <span class="error-text">{problem("qualification")}</span>}
      </div>
      <div class="field">
        <label for="experience">{t("teach_experience")}</label>
        <input
          id="experience"
          class="input"
          inputMode="numeric"
          value={experience}
          onInput={(e) => setExperience(e.currentTarget.value.replace(/[^0-9]/g, ""))}
        />
        {problem("experienceYears") && <span class="error-text">{problem("experienceYears")}</span>}
      </div>
      <div class="field">
        <label for="teach-phone">{t("mobile")}</label>
        <input
          id="teach-phone"
          class="input"
          inputMode="numeric"
          maxLength={10}
          value={phone}
          onInput={(e) => setPhone(e.currentTarget.value)}
        />
        {problem("phone") && <span class="error-text">{problem("phone")}</span>}
      </div>
      <div class="field">
        <label for="bio">{t("teach_bio")}</label>
        <textarea
          id="bio"
          class="input"
          rows={5}
          maxLength={600}
          value={bio}
          onInput={(e) => setBio((e.currentTarget as HTMLTextAreaElement).value)}
        />
        <span class="hint">
          {t("teach_bio_hint")} {bio.length}/600
        </span>
        {problem("bio") && <span class="error-text">{problem("bio")}</span>}
      </div>
      <div class="field">
        <label for="demo">{t("teach_demo")}</label>
        <input id="demo" class="input" type="url" value={demo} onInput={(e) => setDemo(e.currentTarget.value)} />
        {problem("demoUrl") && <span class="error-text">{problem("demoUrl")}</span>}
      </div>
      {failure && <p class="error-text">{failure}</p>}
      <button class="btn primary block" type="submit" disabled={busy}>
        {submitLabel}
      </button>
    </form>
  );
}

function Summary({ application }: { application: TeacherApplicationView }) {
  return (
    <div class="panel">
      <p class="small muted">{when(application.created_at)}</p>
      <strong>{application.subjects.map((s) => t(`subject_${s}`)).join(", ")}</strong>
      <p class="small">
        {application.qualification} · {t("admin_experience", { years: application.experience_years })}
      </p>
      <p class="small muted" style="white-space:pre-wrap">
        {application.bio}
      </p>
    </div>
  );
}

export function TeacherApply() {
  const [data, setData] = useState<TeacherPortal | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  async function load() {
    try {
      const portal = await api<TeacherPortal>("/api/teacher-application");
      setData(portal);
      setEditing(false);
      const current = me.value && me.value.registered ? me.value.user.role : null;
      if (current !== portal.role) await loadMe();
    } catch (e) {
      setFailure(errorText(e instanceof ApiError ? e.code : "network"));
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const back = (
    <button class="btn small quiet" style="justify-self:start" onClick={() => go("profile")}>
      {t("back")}
    </button>
  );

  if (failure) {
    return (
      <div class="screen">
        {back}
        <p class="error-text">{failure}</p>
      </div>
    );
  }
  if (!data) {
    return (
      <div class="screen">
        {back}
        <Loading />
      </div>
    );
  }

  const { role, application, batches } = data;

  if (role === "support" || role === "super_admin") {
    return (
      <div class="screen">
        {back}
        <p class="muted">{t("teach_staff")}</p>
      </div>
    );
  }

  if (role === "teacher") {
    return (
      <div class="screen">
        {back}
        <header class="stack">
          <h1 class="title">{t("teach_approved_title")}</h1>
          <p class="muted">{t("teach_approved_body")}</p>
        </header>
        <section class="stack">
          <h2 class="subtitle">{t("teach_assigned")}</h2>
          {batches.length === 0 ? (
            <p class="muted small">{t("teach_no_batches")}</p>
          ) : (
            <div class="list">
              {batches.map((batch) => (
                <div class="item" key={batch.id}>
                  <span class="name">{pick(batch, "title")}</span>
                  {batch.subject && <span class="meta">{t(`subject_${batch.subject}`)}</span>}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }

  const status = application?.status;

  if (status === "pending" && !editing) {
    return (
      <div class="screen">
        {back}
        <header class="stack">
          <h1 class="title">{t("teach_pending_title")}</h1>
          <p class="muted">{t("teach_pending_body")}</p>
        </header>
        <Summary application={application!} />
        <button class="btn block" onClick={() => setEditing(true)}>
          {t("teach_update")}
        </button>
      </div>
    );
  }

  const rejected = status === "rejected" || status === "suspended";

  return (
    <div class="screen">
      {back}
      <header class="stack">
        <h1 class="title">{rejected && !editing ? t("teach_rejected_title") : t("teach_title")}</h1>
        {!rejected && <p class="muted">{t("teach_intro")}</p>}
      </header>

      {rejected && !editing && (
        <>
          {application?.review_note && (
            <div class="notice pinned">
              <strong class="small">{t("teach_reviewer_note")}</strong>
              <span class="small">{application.review_note}</span>
            </div>
          )}
          <button class="btn primary block" onClick={() => setEditing(true)}>
            {t("teach_reapply")}
          </button>
          <button class="btn quiet block" onClick={clearSignupIntent}>
            {t("teach_continue_as_student")}
          </button>
        </>
      )}

      {(!rejected || editing) && (
        <ApplicationForm
          initial={application}
          submitLabel={status === "pending" ? t("teach_update") : t("teach_submit")}
          onSaved={load}
        />
      )}
    </div>
  );
}
