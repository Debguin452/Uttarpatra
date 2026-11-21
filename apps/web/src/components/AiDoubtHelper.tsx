import { useState } from "preact/hooks";
import { t } from "@coaching-app/shared/i18n";
import { ApiError } from "../lib/api";
import { askDoubtAi } from "../lib/ai";
import { errorText } from "../lib/format";

// Under a posted doubt: an instant AI answer while the teacher's is awaited.
export function AiDoubtHelper({ doubtId, initial }: { doubtId: string; initial: string | null }) {
  const [answer, setAnswer] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ask() {
    setBusy(true);
    setError(null);
    try {
      setAnswer((await askDoubtAi(doubtId)).answer);
    } catch (e) {
      setError(errorText(e instanceof ApiError ? e.code : "network"));
    } finally {
      setBusy(false);
    }
  }

  if (!answer) {
    return (
      <div class="stack">
        <button class="btn small" disabled={busy} onClick={ask}>
          {busy ? t("ai_thinking") : t("ai_get_answer")}
        </button>
        {error && <p class="error-text small">{error}</p>}
      </div>
    );
  }
  return (
    <div class="notice ai-answer">
      <strong class="small">{t("ai_answer_label")}</strong>
      <span class="small" style="white-space:pre-wrap">
        {answer}
      </span>
      <span class="hint">{t("ai_disclaimer")}</span>
    </div>
  );
}
