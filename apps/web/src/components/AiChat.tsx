import { useEffect, useRef, useState } from "preact/hooks";
import { t } from "@coaching-app/shared/i18n";
import { EXAM_PROFILE_KEYS, type ExamProfileKey } from "@coaching-app/shared/examProfiles";
import { RichText } from "./RichText";
import { Select } from "./Select";
import { ApiError } from "../lib/api";
import { clearChat, loadChat, profileLabel, sendChat, type ChatMessage } from "../lib/ai";
import { errorText } from "../lib/format";

// Ask the AI directly, like a tutor. History is kept on the server, so what the
// model sees as "earlier in the conversation" can never be edited from here.
export function AiChat() {
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [text, setText] = useState("");
  const [style, setStyle] = useState<ExamProfileKey | "">("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadChat()
      .then((r) => setMessages(r.messages))
      .catch(() => setMessages([]));
  }, []);
  useEffect(() => end.current?.scrollIntoView({ block: "end", behavior: "smooth" }), [messages?.length, busy]);

  async function send(event: Event) {
    event.preventDefault();
    const message = text.trim();
    if (!message || busy) return;
    setBusy(true);
    setError(null);
    const mine: ChatMessage = { id: -Date.now(), role: "user", content: message, created_at: Math.floor(Date.now() / 1000) };
    setMessages((m) => [...(m ?? []), mine]);
    setText("");
    try {
      const r = await sendChat(message, style || undefined);
      setRemaining(r.remaining);
      setMessages((m) => [...(m ?? []), { id: -Date.now() - 1, role: "assistant", content: r.reply, created_at: Math.floor(Date.now() / 1000) }]);
    } catch (e) {
      setMessages((m) => (m ?? []).filter((x) => x.id !== mine.id));
      setText(message);
      setError(errorText(e instanceof ApiError ? e.code : "network"));
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    await clearChat().catch(() => undefined);
    setMessages([]);
  }

  return (
    <div class="stack">
      <div class="field">
        <label for="ai-style">{t("ai_exam_style")}</label>
        <Select
          id="ai-style"
          value={style}
          onChange={(v) => setStyle(v as ExamProfileKey | "")}
          options={[{ value: "", label: t("ai_style_auto") }, ...EXAM_PROFILE_KEYS.map((k) => ({ value: k, label: profileLabel(k) }))]}
        />
      </div>

      <div class="ai-thread" role="log" aria-live="polite">
        {messages === null && <p class="muted small">{t("loading")}</p>}
        {messages?.length === 0 && <p class="muted small">{t("ai_chat_empty")}</p>}
        {(messages ?? []).map((m) => (
          <div class={m.role === "user" ? "ai-msg mine" : "ai-msg"} key={m.id}>
            <span class="ai-who">{m.role === "user" ? t("you") : t("ai_name")}</span>
            {m.role === "user" ? <span class="ai-text">{m.content}</span> : <RichText class="ai-text" text={m.content} />}
          </div>
        ))}
        {busy && <p class="muted small">{t("ai_thinking")}</p>}
        <div ref={end} />
      </div>

      {error && <p class="error-text">{error}</p>}
      <form class="stack" onSubmit={send}>
        <textarea
          class="input"
          rows={3}
          maxLength={1500}
          placeholder={t("ai_chat_placeholder")}
          value={text}
          onInput={(e) => setText((e.currentTarget as HTMLTextAreaElement).value)}
        />
        <div class="row-between">
          <span class="hint">{remaining !== null ? t("ai_left_today", { n: remaining }) : t("ai_disclaimer")}</span>
          <span class="row-inline">
            {(messages?.length ?? 0) > 0 && (
              <button type="button" class="btn small quiet" onClick={clear}>
                {t("ai_clear")}
              </button>
            )}
            <button class="btn primary small" type="submit" disabled={busy || text.trim().length < 2}>
              {t("ai_send")}
            </button>
          </span>
        </div>
      </form>
      {remaining !== null && <p class="hint">{t("ai_disclaimer")}</p>}
    </div>
  );
}
