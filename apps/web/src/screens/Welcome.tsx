import { t } from "@coaching-app/shared/i18n";
import { LangToggle } from "../components/LangToggle";
import { Logo } from "../components/Logo";
import { beginSignup, finishWelcome } from "../lib/onboarding";

const STEPS = [
  { title: "step1_t", body: "step1_b" },
  { title: "step2_t", body: "step2_b" },
  { title: "step3_t", body: "step3_b" },
] as const;

export function Welcome() {
  return (
    <main class="center">
      <Logo width={240} />
      <LangToggle />
      <div class="stack">
        <h1 class="title">{t("welcome_title")}</h1>
        <p class="muted">{t("welcome_body")}</p>
      </div>

      <section class="stack">
        <h2 class="subtitle">{t("welcome_heading")}</h2>
        <ol class="steps">
          {STEPS.map((step, i) => (
            <li>
              <span class="step-num" aria-hidden="true">
                {i + 1}
              </span>
              <div class="stack" style="gap:2px">
                <strong>{t(step.title)}</strong>
                <span class="muted small">{t(step.body)}</span>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <div class="stack">
        <button class="btn primary block" onClick={beginSignup}>
          {t("get_started")}
        </button>
        <button class="btn quiet block" onClick={() => finishWelcome("in")}>
          {t("have_account")}
        </button>
        <p class="hint legal-links">
          {t("legal_preamble")} <a href="/terms.html" target="_blank" rel="noopener noreferrer">{t("terms_title")}</a> {t("and")}{" "}
          <a href="/privacy.html" target="_blank" rel="noopener noreferrer">{t("privacy_title")}</a>.
        </p>
      </div>
    </main>
  );
}
