import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { t } from "@coaching-app/shared/i18n";
import { IconClock } from "@coaching-app/ui/icons";
import { Sheet, Splash } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { clock, errorText, pick } from "../lib/format";
import { go } from "../lib/router";
import { uid } from "../lib/session";
import { markTestSubmitted } from "../lib/testCache";
import type { StartedTest, SubmitResult } from "../lib/types";

type Saved = { answers: Record<string, string>; flags: string[]; seen: string[] };

function loadSaved(key: string): Saved {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as Saved;
  } catch {
    return { answers: {}, flags: [], seen: [] };
  }
  return { answers: {}, flags: [], seen: [] };
}

function Result({ result, title }: { result: SubmitResult; title: string }) {
  return (
    <div class="screen">
      <header class="stack">
        <p class="eyebrow">{t("results")}</p>
        <h1 class="title">{title}</h1>
      </header>
      <div>
        <span class="score">{result.score}</span>
        <span class="muted"> / {result.totalMarks}</span>
      </div>
      <div class="stats">
        <div>
          <span class="muted small">{t("correct")}</span>
          <strong>{result.correct}</strong>
        </div>
        <div>
          <span class="muted small">{t("wrong")}</span>
          <strong>{result.wrong}</strong>
        </div>
        <div>
          <span class="muted small">{t("skipped")}</span>
          <strong>{result.skipped}</strong>
        </div>
      </div>
      <p class="muted small">
        {t("time_taken")}: {clock(result.timeTakenSec)}
      </p>
      <button class="btn primary block" onClick={() => go("tests")}>
        {t("back_to_tests")}
      </button>
    </div>
  );
}

function Running({ started, onDone }: { started: StartedTest; onDone: (result: SubmitResult) => void }) {
  const storeKey = `attempt:${started.attemptId}`;
  const saved = useMemo(() => loadSaved(storeKey), [storeKey]);
  const [answers, setAnswers] = useState<Record<string, string>>(saved.answers);
  const [flags, setFlags] = useState<string[]>(saved.flags);
  const [seen, setSeen] = useState<string[]>(saved.seen);
  const [index, setIndex] = useState(0);
  const [panel, setPanel] = useState<"none" | "palette" | "confirm">("none");
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submitting = useRef(false);

  const offset = useRef(started.serverNow - Math.floor(Date.now() / 1000)).current;
  const endsAt = started.startedAt + started.durationSec;
  const secondsLeft = () => endsAt - (Math.floor(Date.now() / 1000) + offset);
  const [remaining, setRemaining] = useState(secondsLeft);

  const questions = started.questions;
  const question = questions[index];
  const answered = Object.keys(answers).length;
  const timeUp = remaining <= 0;

  useEffect(() => {
    const timer = setInterval(() => setRemaining(secondsLeft()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(storeKey, JSON.stringify({ answers, flags, seen } satisfies Saved));
    } catch {
      return;
    }
  }, [answers, flags, seen]);

  useEffect(() => {
    if (question && !seen.includes(question.id)) setSeen((s) => [...s, question.id]);
  }, [index]);

  async function submit() {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setSubmitError(null);
    try {
      const result = await api<SubmitResult>("/api/attempts/submit", { body: { testId: started.testId, answers } });
      try {
        localStorage.removeItem(storeKey);
      } catch {
        void 0;
      }
      await markTestSubmitted(uid(), started.testId, result.score);
      onDone(result);
    } catch (e) {
      submitting.current = false;
      setBusy(false);
      setSubmitError(errorText(e instanceof ApiError ? e.code : "network"));
    }
  }

  useEffect(() => {
    if (timeUp) void submit();
  }, [timeUp]);

  if (!question) return <div class="screen"><p class="muted">{t("no_tests")}</p></div>;

  const select = (option: string) => setAnswers((a) => ({ ...a, [question.id]: option }));
  const clear = () =>
    setAnswers((a) => {
      const { [question.id]: _removed, ...rest } = a;
      return rest;
    });
  const toggleFlag = () =>
    setFlags((f) => (f.includes(question.id) ? f.filter((id) => id !== question.id) : [...f, question.id]));
  const jump = (i: number) => {
    setIndex(i);
    setPanel("none");
  };

  return (
    <div>
      <div class="runner-bar">
        <span class="small muted">{pick({ title_bn: started.titleBn, title_en: started.titleEn }, "title")}</span>
        <span class={remaining < 300 ? "timer low" : "timer"}>
          <IconClock size={18} />
          {clock(remaining)}
        </span>
      </div>

      <div class="screen">
        <div class="row-between">
          <span class="eyebrow">{t("question_of", { current: index + 1, total: questions.length })}</span>
          <button class="btn small quiet" onClick={() => setPanel("palette")}>
            {t("palette")}
          </button>
        </div>

        <p class="question">{question.prompt}</p>

        <div class="options" role="radiogroup">
          {question.options.map((option, i) => (
            <button
              class="option"
              role="radio"
              aria-checked={answers[question.id] === option}
              onClick={() => select(option)}
            >
              <span class="letter">{String.fromCharCode(65 + i)}</span>
              <span>{option}</span>
            </button>
          ))}
        </div>

        <div class="runner-actions">
          <button class="btn quiet" onClick={toggleFlag}>
            {flags.includes(question.id) ? t("marked") : t("mark_for_review")}
          </button>
          <button class="btn quiet" onClick={clear} disabled={answers[question.id] === undefined}>
            {t("clear_response")}
          </button>
          <button class="btn" onClick={() => setIndex(index - 1)} disabled={index === 0}>
            {t("previous_question")}
          </button>
          {index < questions.length - 1 ? (
            <button class="btn primary" onClick={() => setIndex(index + 1)}>
              {t("next_question")}
            </button>
          ) : (
            <button class="btn primary" onClick={() => setPanel("confirm")}>
              {t("submit_test")}
            </button>
          )}
        </div>

        <button class="btn danger block" onClick={() => setPanel("confirm")}>
          {t("submit_test")}
        </button>
      </div>

      {panel === "palette" && !timeUp && (
        <Sheet onClose={() => setPanel("none")}>
          <h2 class="subtitle">{t("palette")}</h2>
          <div class="palette">
            {questions.map((q, i) => {
              const state = answers[q.id] !== undefined ? "done" : seen.includes(q.id) ? "seen" : "";
              const className = ["cell", state, flags.includes(q.id) ? "flag" : "", i === index ? "cur" : ""]
                .filter(Boolean)
                .join(" ");
              return (
                <button class={className} onClick={() => jump(i)}>
                  {i + 1}
                </button>
              );
            })}
          </div>
          <div class="legend">
            <span>{t("answered")}</span>
            <span>{t("not_answered")}</span>
            <span>{t("marked")}</span>
            <span>{t("not_visited")}</span>
          </div>
          <button class="btn block" onClick={() => setPanel("none")}>
            {t("close")}
          </button>
        </Sheet>
      )}

      {(panel === "confirm" || timeUp) && (
        <Sheet onClose={timeUp || busy ? undefined : () => setPanel("none")}>
          <h2 class="subtitle">{t("submit_confirm_title")}</h2>
          <p class="muted">{t("submit_confirm_body", { answered, total: questions.length })}</p>
          {submitError && <p class="error-text">{submitError}</p>}
          <button class="btn primary block" onClick={submit} disabled={busy}>
            {t("confirm_submit")}
          </button>
          {!timeUp && (
            <button class="btn quiet block" onClick={() => setPanel("none")} disabled={busy}>
              {t("cancel")}
            </button>
          )}
        </Sheet>
      )}
    </div>
  );
}

export function TestRunner({ testId }: { testId: string }) {
  const [started, setStarted] = useState<StartedTest | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<StartedTest>("/api/attempts/start", { body: { testId } })
      .then((s) => {
        if (!cancelled) setStarted(s);
      })
      .catch((e) => {
        if (!cancelled) setFailure(e instanceof ApiError ? e.code : "network");
      });
    return () => {
      cancelled = true;
    };
  }, [testId]);

  if (failure) {
    return (
      <div class="screen">
        <p class="error-text">{errorText(failure)}</p>
        <button class="btn block" onClick={() => go("tests")}>
          {t("back_to_tests")}
        </button>
      </div>
    );
  }
  if (!started) return <Splash />;
  if (result) {
    return <Result result={result} title={pick({ title_bn: started.titleBn, title_en: started.titleEn }, "title")} />;
  }
  return <Running started={started} onDone={setResult} />;
}
