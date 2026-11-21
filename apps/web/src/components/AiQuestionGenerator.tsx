import { useState } from "preact/hooks";
import { t } from "@coaching-app/shared/i18n";
import { EXAM_PROFILES, EXAM_PROFILE_KEYS, type ExamProfileKey } from "@coaching-app/shared/examProfiles";
import { Select } from "./Select";
import { ApiError } from "../lib/api";
import { generateQuestions, profileLabel } from "../lib/ai";
import type { AdminTestQuestion } from "../lib/adminTypes";
import { errorText, pick } from "../lib/format";
import type { SubjectRow } from "../lib/types";

const MCQ_PROFILES = EXAM_PROFILE_KEYS.filter((k) => EXAM_PROFILES[k].mcq);

// Writes draft questions in the pattern of the chosen exam. Nothing is saved: the
// teacher reads them, adds the ones they want to the test, edits them there, and
// the test stays a draft until a person publishes it.
export function AiQuestionGenerator({
  subjects,
  onAdd,
}: {
  subjects: SubjectRow[];
  onAdd: (questions: AdminTestQuestion[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<ExamProfileKey>("wbchse_sem3");
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState("5");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<AdminTestQuestion[] | null>(null);
  const [dropped, setDropped] = useState(0);

  const active = subjects.filter((s) => s.active);
  const chosen = subject || active[0]?.id || "";

  async function go() {
    setBusy(true);
    setError(null);
    setDrafts(null);
    try {
      const r = await generateQuestions({ profile, subject: chosen, topic, count: Number(count), difficulty });
      setDrafts(r.questions);
      setDropped(r.dropped);
    } catch (e) {
      setError(errorText(e instanceof ApiError ? e.code : "network"));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button class="btn block" type="button" onClick={() => setOpen(true)}>
        {t("ai_gen_title")}
      </button>
    );
  }

  return (
    <section class="panel stack">
      <div class="row-between">
        <strong>{t("ai_gen_title")}</strong>
        <button class="btn small quiet" type="button" onClick={() => setOpen(false)}>
          {t("close")}
        </button>
      </div>
      <p class="hint">{t("ai_gen_note")}</p>

      <div class="field">
        <label for="g-profile">{t("ai_exam_style")}</label>
        <Select id="g-profile" value={profile} onChange={(v) => setProfile(v as ExamProfileKey)} options={MCQ_PROFILES.map((k) => ({ value: k, label: profileLabel(k) }))} />
      </div>
      <div class="field">
        <label for="g-subject">{t("admin_lecture_subject")}</label>
        <Select id="g-subject" value={chosen} onChange={setSubject} options={active.map((s) => ({ value: s.id, label: pick(s, "name") }))} />
      </div>
      <div class="field">
        <label for="g-topic">{t("ai_gen_topic")}</label>
        <input id="g-topic" class="input" maxLength={120} value={topic} onInput={(e) => setTopic(e.currentTarget.value)} />
      </div>
      <div class="row-between" style="gap:var(--space-2)">
        <div class="field" style="flex:1">
          <label for="g-count">{t("ai_gen_count")}</label>
          <Select id="g-count" value={count} onChange={setCount} options={["3", "5", "10"].map((n) => ({ value: n, label: n }))} />
        </div>
        <div class="field" style="flex:1">
          <label for="g-diff">{t("ai_gen_difficulty")}</label>
          <Select
            id="g-diff"
            value={difficulty}
            onChange={(v) => setDifficulty(v as "easy" | "medium" | "hard")}
            options={(["easy", "medium", "hard"] as const).map((d) => ({ value: d, label: t(`ai_gen_${d}`) }))}
          />
        </div>
      </div>
      <button class="btn primary block" type="button" disabled={busy || topic.trim().length < 3 || !chosen} onClick={go}>
        {busy ? t("ai_thinking") : t("ai_gen_go")}
      </button>
      {error && <p class="error-text small">{error}</p>}

      {drafts && (
        <div class="stack">
          {dropped > 0 && <p class="hint">{t("ai_gen_dropped", { n: dropped })}</p>}
          {drafts.map((q, i) => (
            <div class="panel stack" key={i}>
              <p class="small">
                <strong>{i + 1}.</strong> {q.prompt}
              </p>
              <div class="list">
                {(q.options ?? []).map((o) => (
                  <div class="item" key={o}>
                    <span class="name">{o}</span>
                    {o === q.answer && (
                      <span class="side">
                        <span class="badge mark">{t("review_correct_answer")}</span>
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div class="row-between">
            <button class="btn small quiet" type="button" onClick={() => setDrafts(null)}>
              {t("ai_gen_discard")}
            </button>
            <button
              class="btn primary small"
              type="button"
              onClick={() => {
                onAdd(drafts);
                setDrafts(null);
                setOpen(false);
              }}
            >
              {t("ai_gen_add")}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
