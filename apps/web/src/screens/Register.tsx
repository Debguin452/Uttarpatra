import { useState } from "preact/hooks";
import { t } from "@coaching-app/shared/i18n";
import { ProfileUpsert } from "@coaching-app/shared/schema";
import { api, ApiError } from "../lib/api";
import { authUser, loadMe, me } from "../lib/session";
import { errorText } from "../lib/format";
import { go } from "../lib/router";
import { Select } from "../components/Select";
import { Logo } from "../components/Logo";
import { OnboardingProgress } from "../components/OnboardingProgress";
import type { SignupIntent } from "../lib/onboarding";

export function Register({ mode, intent }: { mode: "create" | "edit"; intent?: SignupIntent }) {
  const current = me.value && me.value.registered ? me.value.user : null;
  const isTeacherSignup = mode === "create" && intent === "teacher";
  const [name, setName] = useState(current?.name ?? authUser.value?.displayName ?? "");
  const [phone, setPhone] = useState(current?.phone ?? "");
  const [studentClass, setStudentClass] = useState(current?.student_class ?? "");
  const [board, setBoard] = useState(current?.board ?? "");
  const [school, setSchool] = useState(current?.school ?? "");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [failure, setFailure] = useState<string | null>(null);
  // Client-side gate only, pending the real guardian-consent capture
  // (a DB column + verification flow) that DPDP Rule 10 will require
  // once it's in force — see Privacy.tsx. This at least stops signup
  // without the acknowledgment, rather than shipping no check at all.
  const [guardianAware, setGuardianAware] = useState(false);

  async function submit(event: Event) {
    event.preventDefault();
    if (mode === "create" && !isTeacherSignup && !guardianAware) {
      setFailure(t("guardian_required"));
      return;
    }
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
      else if (isTeacherSignup) go("teach");
    } catch (e) {
      setFailure(errorText(e instanceof ApiError ? e.code : "network"));
      setBusy(false);
    }
  }

  const field = (key: string) => errors[key]?.[0];

  return (
    <main class={mode === "create" ? "center" : "screen"}>
      {mode === "create" && <Logo width={130} />}
      {mode === "create" && <OnboardingProgress step={3} />}
      <h1 class="title">{isTeacherSignup ? t("register_title_teacher") : t("register_title")}</h1>
      {mode === "create" && name.trim().length > 1 && (
        <p class="muted">{t("register_greeting", { name: name.trim().split(" ")[0] ?? "" })}</p>
      )}
      {isTeacherSignup && <p class="muted">{t("register_title_teacher_body")}</p>}
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
        {!isTeacherSignup && (
          <>
            <div class="field">
              <label for="class">{t("student_class")}</label>
              <Select
              id="class"
              value={studentClass}
              onChange={setStudentClass}
              options={[
                { value: "", label: t("select_none") },
                ...["5", "6", "7", "8", "9", "10", "11", "12"].map((grade) => ({
                  value: grade,
                  label: t(`class_${grade}`),
                  group: t("admin_group_school"),
                })),
                { value: "dropper", label: t("class_dropper"), group: t("class_group_other") },
              ]}
            />
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
          </>
        )}
        {mode === "create" && !isTeacherSignup && (
          <label class="check">
            <input
              type="checkbox"
              checked={guardianAware}
              onChange={(e) => setGuardianAware(e.currentTarget.checked)}
            />
            <span class="small">
              {t("guardian_aware")} {t("legal_preamble")} <a href="#/terms">{t("terms_title")}</a> {t("and")}{" "}
              <a href="#/privacy">{t("privacy_title")}</a>.
            </span>
          </label>
        )}
        {failure && <p class="error-text">{failure}</p>}
        <button class="btn primary block" type="submit" disabled={busy}>
          {mode === "create" ? t("save_continue") : t("save")}
        </button>
      </form>
    </main>
  );
}
