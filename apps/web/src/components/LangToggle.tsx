import { locale, setLocale } from "@coaching-app/shared/i18n";

export function LangToggle() {
  return (
    <div class="chips" role="group" aria-label="Language">
      <button class="chip" aria-pressed={locale.value === "en"} onClick={() => setLocale("en")}>
        English
      </button>
      <button class="chip" aria-pressed={locale.value === "bn"} onClick={() => setLocale("bn")}>
        বাংলা
      </button>
    </div>
  );
}
