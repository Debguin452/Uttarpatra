import { t } from "@coaching-app/shared/i18n";

const STEPS = ["onboarding_step_role", "onboarding_step_account", "onboarding_step_profile"] as const;

export function OnboardingProgress({ step }: { step: 1 | 2 | 3 }) {
  return (
    <ol class="onb-progress" aria-label={t("onboarding_step_role")}>
      {STEPS.map((label, i) => {
        const n = i + 1;
        const state = n < step ? "done" : n === step ? "current" : "upcoming";
        return (
          <li class={`onb-step onb-step-${state}`} aria-current={state === "current" ? "step" : undefined}>
            <span class="onb-dot" aria-hidden="true">
              {state === "done" ? "✓" : n}
            </span>
            <span class="onb-label">{t(label)}</span>
          </li>
        );
      })}
    </ol>
  );
}
