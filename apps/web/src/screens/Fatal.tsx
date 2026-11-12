import { t } from "@coaching-app/shared/i18n";
import { fatal } from "../lib/api";
import { logOut } from "../lib/session";

export function Fatal() {
  const blocked = fatal.value === "account_blocked";
  return (
    <main class="center">
      <h1 class="title">{blocked ? t("blocked_title") : t("device_mismatch_title")}</h1>
      <p class="muted">{blocked ? t("blocked_body") : t("device_mismatch_body")}</p>
      <button class="btn block" onClick={logOut}>
        {t("sign_out")}
      </button>
    </main>
  );
}
