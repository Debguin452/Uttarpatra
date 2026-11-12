import { useState } from "preact/hooks";
import { t } from "@coaching-app/shared/i18n";
import { ProfileUpsert } from "@coaching-app/shared/schema";
import { api, ApiError } from "../lib/api";
import { authUser, loadMe, me } from "../lib/session";
import { errorText } from "../lib/format";
import { go } from "../lib/router";

export function Register({ mode }: { mode: "create" | "edit" }) {
  const current = me.value && me.value.registered ? me.value.user : null;
  const [name, setName] = useState(current?.name ?? authUser.value?.displayName ?? "");
  const [phone, setPhone] = useState(current?.phone ?? "");
  const [studentClass, setStudentClass] = useState(current?.student_class ?? "");
  const [board, setBoard] = useState(current?.board ?? "");
  const [school, setSchool] = useState(current?.school ?? "");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [failure, setFailure] = useState<string | null>(null);

  async function submit(event: Event) {
    event.preventDefault();
    const parsed = ProfileUpsert.safeParse({
      name,
      phone: phone || undefined,
      studentClass: studentClass || undefined,
      board: board || undefined,
      school: school || undefined,
    });
    if (!parsed.success) {
      setErrors(parsed.error.flatten().fieldErrors);
      return;
    }
    setErrors({});
    setFailure(null);
    setBusy(true);
    try {
      await api("/api/me", { method: "PUT", body: parsed.data });
      await loadMe();
      if (mode === "edit") go("profile");
    } catch (e) {
      setFailure(errorText(e instanceof ApiError ? e.code : "network"));
      setBusy(false);
    }
  }

  const field = (key: string) => errors[key]?.[0];

  return (
    <main class={mode === "create" ? "center" : "screen"}>
      <h1 class="title">{t("register_title")}</h1>
      <form class="stack" onSubmit={submit}>
        <div class="field">
          <label for="name">{t("full_name")}</label>
          <input id="name" class="input" value={name} onInput={(e) => setName(e.currentTarget.value)} required />
          {field("name") && <span class="error-text">{field("name")}</span>}
        </div>
        <div class="field">
          <label for="phone">{t("mobile")}</label>
          <input
            id="phone"
            class="input"
            inputMode="numeric"
            maxLength={10}
            value={phone}
            onInput={(e) => setPhone(e.currentTarget.value)}
          />
          {field("phone") && <span class="error-text">{field("phone")}</span>}
        </div>
        <div class="field">
          <label for="class">{t("student_class")}</label>
          <select id="class" class="input" value={studentClass} onChange={(e) => setStudentClass(e.currentTarget.value)}>
            <option value="" />
            <option value="11">{t("class_11")}</option>
            <option value="12">{t("class_12")}</option>
            <option value="dropper">{t("class_dropper")}</option>
          </select>
          <span class="hint">{t("class_hint")}</span>
        </div>
        <div class="field">
          <label for="board">{t("board")}</label>
          <input id="board" class="input" value={board} onInput={(e) => setBoard(e.currentTarget.value)} />
        </div>
        <div class="field">
          <label for="school">{t("school")}</label>
          <input id="school" class="input" value={school} onInput={(e) => setSchool(e.currentTarget.value)} />
        </div>
        {failure && <p class="error-text">{failure}</p>}
        <button class="btn primary block" type="submit" disabled={busy}>
          {mode === "create" ? t("save_continue") : t("save")}
        </button>
      </form>
    </main>
  );
}
