import { t } from "@coaching-app/shared/i18n";
import { IconBatches, IconProfile } from "@coaching-app/ui/icons";
import { LangToggle } from "../components/LangToggle";
import { chooseSignupRole } from "../lib/onboarding";

export function RoleSelect() {
  return (
    <main class="center">
      <LangToggle />
      <div class="stack">
        <h1 class="title">{t("role_select_title")}</h1>
        <p class="muted">{t("role_select_body")}</p>
      </div>

      <div class="stack">
        <button class="panel role-card" onClick={() => chooseSignupRole("student")}>
          <IconBatches size={28} />
          <span class="stack" style="gap:2px">
            <strong>{t("role_select_student")}</strong>
            <span class="small muted">{t("role_select_student_body")}</span>
          </span>
        </button>
        <button class="panel role-card" onClick={() => chooseSignupRole("teacher")}>
          <IconProfile size={28} />
          <span class="stack" style="gap:2px">
            <strong>{t("role_select_teacher")}</strong>
            <span class="small muted">{t("role_select_teacher_body")}</span>
          </span>
        </button>
      </div>
    </main>
  );
}
