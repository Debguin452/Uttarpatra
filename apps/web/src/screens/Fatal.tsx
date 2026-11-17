import { t } from "@coaching-app/shared/i18n";
import { logOut } from "../lib/session";
import { Logo } from "../components/Logo";

export function Fatal() {
  return (
    <main class="center">
      <Logo width={140} />
      <h1 class="title">{t("blocked_title")}</h1>
      <p class="muted">{t("blocked_body")}</p>
      <button class="btn block" onClick={logOut}>
        {t("sign_out")}
      </button>
    </main>
  );
}
