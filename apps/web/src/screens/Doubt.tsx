import { useState } from "preact/hooks";
import { t } from "@coaching-app/shared/i18n";
import { DoubtCreate } from "@coaching-app/shared/schema";
import { IconTray } from "@coaching-app/ui/icons";
import { AiChat } from "../components/AiChat";
import { CommunityBanners } from "../components/CommunityBanners";
import { AiDoubtHelper } from "../components/AiDoubtHelper";
import { AnimatedCheck, EmptyState, SkeletonList } from "../components/ui";
import { Select } from "../components/Select";
import { api, ApiError } from "../lib/api";
import { errorText, pick, when } from "../lib/format";
import { useMyBatches, useSubjects } from "../lib/queries";
import { subjectNames } from "../lib/subjects";
import type { MyDoubt } from "../lib/types";
import { useLoad } from "../lib/useLoad";

export function Doubt() {
  const myBatches = useMyBatches();
  const subjects = useSubjects();
  const mine = useLoad(() => api<MyDoubt[]>("/api/doubts/mine"));

  const [batchId, setBatchId] = useState("");
  // With only one batch there is nothing to choose: it is picked for them.
  const batchDefault = (myBatches.data ?? []).length === 1 ? myBatches.data![0]!.id : "";
  const [subject, setSubject] = useState("");
  const [question, setQuestion] = useState("");
  const [drive, setDrive] = useState("");
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [tab, setTab] = useState<"ai" | "teacher">("ai");

  async function submit(event: Event) {
    event.preventDefault();
    setSent(false);
    const parsed = DoubtCreate.safeParse({
      batchId: batchId || batchDefault || "",
      subject: subject || undefined,
      questionText: question,
      imageDriveId: drive.trim() || undefined,
    });
    if (!parsed.success) {
      setErrors(parsed.error.flatten().fieldErrors);
      return;
    }
    setErrors({});
    setFailure(null);
    setBusy(true);
    try {
      await api("/api/doubts", { body: parsed.data });
      setQuestion("");
      setDrive("");
      setSent(true);
      await mine.reload();
    } catch (e) {
      setFailure(errorText(e instanceof ApiError ? e.code : "network"));
    }
    setBusy(false);
  }

  const problem = (key: string) => errors[key]?.[0];
  const activeSubjects = (subjects.data ?? []).filter((s) => s.active);

  return (
    <div class="screen">
      <header class="stack">
        <h1 class="title">{t("doubt_title")}</h1>
        <p class="muted small">{t("doubt_intro")}</p>
      </header>

      <CommunityBanners />

      <div class="tabs" role="tablist">
        <button class="btn small" role="tab" aria-selected={tab === "ai"} aria-pressed={tab === "ai"} onClick={() => setTab("ai")}>
          {t("doubt_tab_ai")}
        </button>
        <button class="btn small" role="tab" aria-selected={tab === "teacher"} aria-pressed={tab === "teacher"} onClick={() => setTab("teacher")}>
          {t("doubt_tab_teacher")}
        </button>
      </div>

      {tab === "ai" && <AiChat />}

      {tab === "teacher" && (
      <>
      <form class="stack" onSubmit={submit}>
        <div class="field">
          <label for="d-batch">{t("doubt_batch")}</label>
          <Select
            id="d-batch"
            value={batchId || batchDefault}
            onChange={setBatchId}
            placeholder={t("doubt_batch_pick")}
            options={(myBatches.data ?? []).map((b) => ({ value: b.id, label: pick(b, "title") }))}
          />
          <span class="hint">{t("doubt_batch_hint")}</span>
          {problem("batchId") && <span class="error-text">{problem("batchId")}</span>}
        </div>
        <div class="field">
          <label for="d-subject">{t("doubt_subject")}</label>
          <Select
            id="d-subject"
            value={subject}
            onChange={setSubject}
            options={[
              { value: "", label: t("select_none") },
              ...activeSubjects.map((s) => ({ value: s.id, label: pick(s, "name") })),
            ]}
          />
        </div>
        <div class="field">
          <label for="d-question">{t("doubt_question")}</label>
          <textarea
            id="d-question"
            class="input"
            rows={4}
            maxLength={1000}
            value={question}
            onInput={(e) => setQuestion((e.currentTarget as HTMLTextAreaElement).value)}
          />
          {problem("questionText") && <span class="error-text">{problem("questionText")}</span>}
        </div>
        <div class="field">
          <label for="d-drive">{t("doubt_drive")}</label>
          <input id="d-drive" class="input" value={drive} onInput={(e) => setDrive(e.currentTarget.value)} />
          <span class="hint">{t("doubt_drive_hint")}</span>
        </div>
        {failure && <p class="error-text">{failure}</p>}
        {sent && (
          <div class="row-between" style="justify-content:flex-start;gap:var(--space-2)">
            <AnimatedCheck size={22} />
            <span class="small">{t("doubt_sent")}</span>
          </div>
        )}
        <button class="btn primary block" type="submit" disabled={busy || question.trim().length < 5}>
          {t("doubt_submit")}
        </button>
      </form>

      <section class="stack">
        <h2 class="subtitle">{t("doubt_mine")}</h2>
        {mine.error && <p class="error-text">{mine.error}</p>}
        {mine.loading && !mine.data && <SkeletonList rows={2} />}
        {mine.data && mine.data.length === 0 && <EmptyState icon={<IconTray size={36} />} text={t("doubt_none")} />}
        <div class="stack">
          {(mine.data ?? []).map((d) => (
            <div class="panel" key={d.id}>
              <div class="row-between">
                <span class="small muted">{when(d.created_at)}</span>
                <span class={d.status === "open" ? "badge live" : "badge mark"}>
                  {t(d.status === "open" ? "teach_doubt_open" : "answered")}
                </span>
              </div>
              {d.subject && <span class="small muted">{subjectNames(subjects.data, [d.subject])}</span>}
              <p class="small" style="white-space:pre-wrap">
                {d.question_text}
              </p>
              {d.answer_text && (
                <div class="notice pinned">
                  <strong class="small">{t("doubt_answer")}</strong>
                  <span class="small" style="white-space:pre-wrap">
                    {d.answer_text}
                  </span>
                </div>
              )}
              {(d.status === "open" || d.ai_answer) && <AiDoubtHelper doubtId={d.id} initial={d.ai_answer} />}
            </div>
          ))}
        </div>
      </section>
      </>
      )}
    </div>
  );
}
