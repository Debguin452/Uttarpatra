import { useState } from "preact/hooks";
import { t } from "@coaching-app/shared/i18n";
import { ApiError, api } from "../lib/api";
import { explainQuestion } from "../lib/ai";
import { errorText } from "../lib/format";
import { useLoad } from "../lib/useLoad";
import { Loading } from "./ui";

type ReviewQuestion = {
  id: string;
  prompt: string;
  options: string[];
  answer: string;
  yourAnswer: string | null;
  correct: boolean | null;
};

function Explain({ testId, questionId }: { testId: string; questionId: string }) {
  const [text, setText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ask() {
    setBusy(true);
    setError(null);
    try {
      setText((await explainQuestion(testId, questionId)).explanation);
    } catch (e) {
      setError(errorText(e instanceof ApiError ? e.code : "network"));
    } finally {
      setBusy(false);
    }
  }

  if (text) {
    return (
      <div class="notice ai-answer">
        <strong class="small">{t("ai_answer_label")}</strong>
        <span class="small" style="white-space:pre-wrap">
          {text}
        </span>
        <span class="hint">{t("ai_disclaimer")}</span>
      </div>
    );
  }
  return (
    <div class="stack">
      <button class="btn small" disabled={busy} onClick={ask}>
        {busy ? t("ai_thinking") : t("ai_explain")}
      </button>
      {error && <p class="error-text small">{error}</p>}
    </div>
  );
}

function ReviewList({ testId }: { testId: string }) {
  const review = useLoad(() => api<{ questions: ReviewQuestion[] }>(`/api/attempts/${encodeURIComponent(testId)}/review`));
  if (review.loading && !review.data) return <Loading />;
  if (review.error) return <p class="error-text small">{review.error}</p>;

  return (
    <div class="stack">
      {(review.data?.questions ?? []).map((q, i) => (
        <div class="panel stack" key={q.id}>
          <p class="small" style="white-space:pre-wrap">
            <strong>{i + 1}.</strong> {q.prompt}
          </p>
          <div class="list">
            {q.options.map((option) => (
              <div class="item" key={option}>
                <span class="name">{option}</span>
                <span class="side">
                  {option === q.answer && <span class="badge mark">{t("review_correct_answer")}</span>}
                  {option === q.yourAnswer && <span class="badge">{t("review_your_answer")}</span>}
                </span>
              </div>
            ))}
          </div>
          {q.yourAnswer === null && <p class="muted small">{t("review_not_answered")}</p>}
          {q.correct !== true && <Explain testId={testId} questionId={q.id} />}
        </div>
      ))}
    </div>
  );
}

// "Review your answers": every question with your answer beside the right one,
// and an AI explanation on demand for the ones you missed.
export function TestReview({ testId }: { testId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <section class="stack">
      <button class="btn block" onClick={() => setOpen(!open)} aria-expanded={open}>
        {open ? t("review_hide") : t("review_answers")}
      </button>
      {open && <ReviewList testId={testId} />}
    </section>
  );
}
