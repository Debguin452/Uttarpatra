import { useState } from "preact/hooks";
import { t } from "@coaching-app/shared/i18n";
import { DoubtAnswer } from "@coaching-app/shared/schema";
import { Logo } from "../../components/Logo";
import { NotificationBell } from "../../components/NotificationBell";
import { RichText } from "../../components/RichText";
import { TeacherNotifications } from "./TeacherNotifications";
import { Loading, Sheet } from "../../components/ui";
import { api, ApiError } from "../../lib/api";
import { errorText, pick, when } from "../../lib/format";
import { segments } from "../../lib/router";
import { useSubjects } from "../../lib/queries";
import { logOut, me } from "../../lib/session";
import { subjectNames } from "../../lib/subjects";
import type { TeacherDoubt, TeacherPortal, TeacherStudentDetail, TeacherStudentRow } from "../../lib/types";
import { useLoad } from "../../lib/useLoad";
import { Profile } from "../Profile";
import { Register } from "../Register";
import { TeacherChapters } from "./TeacherChapters";
import { TeacherLectures } from "./TeacherLectures";
import { TeacherMaterials } from "./TeacherMaterials";
import { TeacherNotices } from "./TeacherNotices";
import { TeacherTests } from "./TeacherTests";

const TABS = [
  { id: "batches", label: "teach_tab_batches" },
  { id: "lectures", label: "teach_tab_lectures" },
  { id: "chapters", label: "admin_tab_chapters" },
  { id: "materials", label: "teach_tab_materials" },
  { id: "tests", label: "teach_tab_tests" },
  { id: "notices", label: "teach_tab_notices" },
  { id: "students", label: "teach_tab_students" },
  { id: "doubts", label: "teach_tab_doubts" },
  { id: "notify", label: "teach_tab_notify" },
] as const;
type TabId = (typeof TABS)[number]["id"];

function TeacherBatches() {
  const portal = useLoad(() => api<TeacherPortal>("/api/teacher-application"));
  const subjects = useSubjects();

  if (portal.error) return <p class="error-text">{portal.error}</p>;
  if (portal.loading && !portal.data) return <Loading />;
  const batches = portal.data?.batches ?? [];

  return (
    <div class="stack">
      <h1 class="title">{t("teach_tab_batches")}</h1>
      {batches.length === 0 ? (
        <p class="muted small">{t("teach_no_batches")}</p>
      ) : (
        <div class="list">
          {batches.map((b) => (
            <div class="item" key={b.id}>
              <span class="name">{pick(b, "title")}</span>
              <span class="meta">{b.subject ? subjectNames(subjects.data, [b.subject]) : t("admin_no_subject")}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StudentDetail({ uid, onBack }: { uid: string; onBack: () => void }) {
  const detail = useLoad(() => api<TeacherStudentDetail>(`/api/teacher/students/${uid}`), [uid]);

  return (
    <div class="stack">
      <button class="btn small quiet" style="justify-self:start" onClick={onBack}>
        {t("back")}
      </button>
      {detail.error && <p class="error-text">{detail.error}</p>}
      {detail.loading && !detail.data && <Loading />}
      {detail.data && (
        <>
          <header class="stack" style="gap:2px">
            <h1 class="title">{detail.data.student.name}</h1>
            <p class="muted small">
              {detail.data.student.phone ?? "—"}
              {detail.data.student.student_class ? ` · ${t(`class_${detail.data.student.student_class}`)}` : ""}
              {detail.data.student.board ? ` · ${detail.data.student.board}` : ""}
              {detail.data.student.school ? ` · ${detail.data.student.school}` : ""}
            </p>
          </header>

          <section class="stack">
            <h2 class="subtitle">{t("teach_student_batches")}</h2>
            {detail.data.enrollments.length === 0 ? (
              <p class="muted small">—</p>
            ) : (
              <div class="list">
                {detail.data.enrollments.map((e) => (
                  <div class="item" key={e.batch_id}>
                    <span class="name">{pick(e, "title")}</span>
                    <span class="meta">{when(e.created_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section class="stack">
            <h2 class="subtitle">{t("teach_student_tests")}</h2>
            {detail.data.attempts.length === 0 ? (
              <p class="muted small">{t("teach_no_attempts")}</p>
            ) : (
              <div class="list">
                {detail.data.attempts.map((a, i) => (
                  <div class="item" key={i}>
                    <span class="name">{pick(a, "title")}</span>
                    <span class="meta">
                      {t("score")}: {a.score} ({a.correct_count}/{a.correct_count + a.wrong_count}) · {when(a.submitted_at)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function TeacherStudents() {
  const [openUid, setOpenUid] = useState<string | null>(null);
  const list = useLoad(() => api<TeacherStudentRow[]>("/api/teacher/students"));

  if (openUid) return <StudentDetail uid={openUid} onBack={() => setOpenUid(null)} />;

  return (
    <div class="stack">
      <h1 class="title">{t("teach_tab_students")}</h1>
      {list.error && <p class="error-text">{list.error}</p>}
      {list.loading && !list.data && <Loading />}
      {list.data && list.data.length === 0 && <p class="muted small">{t("teach_no_students")}</p>}
      <div class="list">
        {(list.data ?? []).map((student) => (
          <button class="item" key={student.uid} onClick={() => setOpenUid(student.uid)}>
            <span class="name">{student.name}</span>
            <span class="meta">
              {student.phone ?? "—"}
              {student.student_class ? ` · ${t(`class_${student.student_class}`)}` : ""} ·{" "}
              {t("admin_batches_count", { count: student.batches_with_me })}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function TeacherDoubts() {
  const list = useLoad(() => api<TeacherDoubt[]>("/api/teacher/doubts"));
  const subjects = useSubjects();
  const [answering, setAnswering] = useState<TeacherDoubt | null>(null);
  const [answer, setAnswer] = useState("");
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!answering) return;
    const parsed = DoubtAnswer.safeParse({ answerText: answer });
    if (!parsed.success) {
      setErrors(parsed.error.flatten().fieldErrors);
      return;
    }
    setErrors({});
    setFailure(null);
    setBusy(true);
    try {
      await api(`/api/teacher/doubts/${answering.id}/answer`, { body: parsed.data });
      setAnswering(null);
      setAnswer("");
      await list.reload();
    } catch (e) {
      setFailure(errorText(e instanceof ApiError ? e.code : "network"));
    }
    setBusy(false);
  }

  return (
    <div class="stack">
      <h1 class="title">{t("teach_tab_doubts")}</h1>
      {list.error && <p class="error-text">{list.error}</p>}
      {list.loading && !list.data && <Loading />}
      {list.data && list.data.length === 0 && <p class="muted small">{t("teach_no_doubts")}</p>}

      <div class="stack">
        {(list.data ?? []).map((doubt) => (
          <div class="panel" key={doubt.id}>
            <div class="row-between">
              <strong>{doubt.name}</strong>
              <span class={doubt.status === "open" ? "badge live" : "badge mark"}>
                {t(doubt.status === "open" ? "teach_doubt_open" : "answered")}
              </span>
            </div>
            <span class="small muted">
              {doubt.batch_title_en ?? "—"}
              {doubt.subject ? ` · ${subjectNames(subjects.data, [doubt.subject])}` : ""} · {when(doubt.created_at)}
            </span>
            <p class="small" style="white-space:pre-wrap">
              {doubt.question_text}
            </p>
            {doubt.image_b64 && <img class="doubt-photo-preview" src={`data:image/jpeg;base64,${doubt.image_b64}`} alt="" />}
            {!doubt.image_b64 && doubt.image_drive_id && (
              <a
                class="small"
                href={`https://drive.google.com/file/d/${doubt.image_drive_id}/view`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("teach_doubt_attachment")}
              </a>
            )}
            {doubt.answer_text && (
              <div class="notice pinned">
                <strong class="small">{t("teach_doubt_your_answer")}</strong>
                <RichText class="small" text={doubt.answer_text} />
              </div>
            )}
            {doubt.status === "open" && (
              <button class="btn" onClick={() => setAnswering(doubt)}>
                {t("teach_doubt_answer")}
              </button>
            )}
          </div>
        ))}
      </div>

      {answering && (
        <Sheet onClose={busy ? undefined : () => setAnswering(null)}>
          <h2 class="subtitle">{t("teach_doubt_answer")}</h2>
          <p class="small muted" style="white-space:pre-wrap">
            {answering.question_text}
          </p>
          <div class="field">
            <label for="ans">{t("teach_doubt_answer")}</label>
            <textarea
              id="ans"
              class="input"
              rows={5}
              maxLength={2000}
              value={answer}
              onInput={(e) => setAnswer((e.currentTarget as HTMLTextAreaElement).value)}
            />
            {errors.answerText?.[0] && <span class="error-text">{errors.answerText[0]}</span>}
          </div>
          {failure && <p class="error-text">{failure}</p>}
          <button class="btn primary block" onClick={submit} disabled={busy || !answer.trim()}>
            {t("teach_doubt_submit")}
          </button>
          <button class="btn quiet block" onClick={() => setAnswering(null)} disabled={busy}>
            {t("cancel")}
          </button>
        </Sheet>
      )}
    </div>
  );
}

export function TeacherShell() {
  const [head, tab] = segments();
  const name = me.value && me.value.registered ? me.value.user.name : "";
  const onProfile = head === "profile";
  const current: TabId = onProfile ? "batches" : (TABS.find((entry) => entry.id === tab)?.id ?? "batches");

  const links = TABS.map((entry) => (
    <a href={`#/teach/${entry.id}`} aria-current={!onProfile && current === entry.id ? "page" : undefined}>
      {t(entry.label)}
    </a>
  ));

  return (
    <div class="admin">
      <aside class="admin-side">
        <div class="stack">
          <Logo width={176} start />
          <strong class="eyebrow">{t("teach_console")}</strong>
          <nav aria-label="Teacher">{links}</nav>
        </div>
        <div class="stack">
          <NotificationBell />
          <a href="#/profile" class="who" aria-current={onProfile ? "page" : undefined}>
            <strong>{name}</strong>
            <span class="small muted">{t("role_teacher")}</span>
          </a>
          <button class="btn small quiet" onClick={logOut}>
            {t("sign_out")}
          </button>
        </div>
      </aside>

      <header class="admin-top">
        <div class="row-between">
          <span class="brand-row">
            <Logo width={46} start />
            <strong class="brand">{t("teach_console")}</strong>
          </span>
          <span class="row-inline">
            <NotificationBell />
            <a href="#/profile" class="small">
              {name}
            </a>
          </span>
        </div>
        <nav class="admin-tabs" aria-label="Teacher">
          {links}
        </nav>
      </header>

      <main class="admin-main">
        {onProfile ? (
          tab === "edit" ? <Register mode="edit" /> : <Profile />
        ) : current === "batches" ? (
          <TeacherBatches />
        ) : current === "lectures" ? (
          <TeacherLectures />
        ) : current === "chapters" ? (
          <TeacherChapters />
        ) : current === "materials" ? (
          <TeacherMaterials />
        ) : current === "tests" ? (
          <TeacherTests />
        ) : current === "notices" ? (
          <TeacherNotices />
        ) : current === "students" ? (
          <TeacherStudents />
        ) : current === "notify" ? (
          <TeacherNotifications />
        ) : (
          <TeacherDoubts />
        )}
      </main>
    </div>
  );
}
