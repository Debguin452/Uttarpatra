import { t } from "@coaching-app/shared/i18n";

export function Doubt() {
  return (
    <div class="screen">
      <h1 class="title">{t("doubt_title")}</h1>
      <p class="muted">{t("doubt_soon")}</p>
    </div>
  );
}
