import { useState } from "preact/hooks";
import { t } from "@coaching-app/shared/i18n";
import { DoubtAnswer } from "@coaching-app/shared/schema";
import { Field, Segmented } from "../../components/adminUi";
import { Loading, Sheet } from "../../components/ui";
import { api, ApiError } from "../../lib/api";
import { askDoubtAi } from "../../lib/ai";
import { errorText, when } from "../../lib/format";
import { useLoad } from "../../lib/useLoad";

type Doubt = {
  id: string;
  name: string;
  batch_title_en: string | null;
  subject: string | null;
  question_text: string;
  status: "open" | "answered";
  answer_text: string | null;
  ai_answer: string | null;
  created_at: number;
  answered_by_name: string | null;
};

// Every doubt from every batch. Teachers see only the ones sent to them; admins see them all.
export function AdminDoubts() {
  const [status, setStatus] = useState<"open" | "answered">("open");
  const list = useLoad(() => api<Doubt[]>(`/api/admin/doubts?status=${status}`), [status]);
  const [answering, setAnswering] = useState<Doubt | null>(null);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function open(d: Doubt) {
    setAnswering(d);
    setAnswer(d.answer_text ?? "");
    setError(null);
  }

  async function draft() {
    if (!answering) return;
    setBusy(true);
    setError(null);
    try {
      const text = (await askDoubtAi(answering.id)).answer.slice(0, 2000);
      setAnswer((current) => (current.trim() ? current : text));
    } catch (e) {
      setError(errorText(e instanceof ApiError ? e.code : "network"));
    }
    setBusy(false);
  }

  async function send() {
    if (!answering) return;
    const parsed = DoubtAnswer.safeParse({ answerText: answer });
    if (!parsed.success) {
      setError(errorText("invalid_input"));
      return;
    }
    setBusy(true);
    try {
      await api(`/api/admin/doubts/${answering.id}/answer`, { body: parsed.data });
      setAnswering(null);
      await list.reload();
    } catch (e) {
      setError(errorText(e instanceof ApiError ? e.code : "network"));
    }
    setBusy(false);
  }

  return (
    <div class="stack">
      <h1 class="title">{t("admin_tab_doubts")}</h1>
      <Segmented
        label={t("admin_tab_doubts")}
        value={status}
        onChange={setStatus}
        options={[
          { id: "open", label: t("admin_doubts_open") },
          { id: "answered", label: t("admin_doubts_answered") },
        ]}
      />
      {list.loading && !list.data && <Loading />}
      {list.error && <p class="error-text">{list.error}</p>}
      {list.data?.length === 0 && <p class="muted small">{t("admin_doubts_none")}</p>}
      <div class="list">
        {(list.data ?? []).map((d) => (
          <button class="item" key={d.id} onClick={() => open(d)}>
            <span class="name">{d.question_text.slice(0, 90)}</span>
            <span class="meta">
              {[d.name, d.batch_title_en ?? t("admin_doubt_no_batch"), d.subject, when(d.created_at)].filter(Boolean).join(" · ")}
            </span>
          </button>
        ))}
      </div>

      {answering && (
        <Sheet onClose={busy ? undefined : () => setAnswering(null)}>
          <h2 class="subtitle">{answering.name}</h2>
          <p class="small" style="white-space:pre-wrap">{answering.question_text}</p>
          {answering.answered_by_name && <p class="hint">{t("admin_doubt_answered_by", { name: answering.answered_by_name })}</p>}
          <button class="btn small" disabled={busy} onClick={draft}>
            {busy ? t("ai_thinking") : t("ai_draft")}
          </button>
          <p class="hint">{t("ai_draft_hint")}</p>
          <Field id="ad-answer" label={t("teach_doubt_answer")}>
            <textarea id="ad-answer" class="input" rows={6} maxLength={2000} value={answer} onInput={(e) => setAnswer((e.currentTarget as HTMLTextAreaElement).value)} />
          </Field>
          {error && <p class="error-text">{error}</p>}
          <button class="btn primary block" disabled={busy} onClick={send}>
            {t("ai_send")}
          </button>
          <button class="btn quiet block" disabled={busy} onClick={() => setAnswering(null)}>
            {t("cancel")}
          </button>
        </Sheet>
      )}
    </div>
  );
}
