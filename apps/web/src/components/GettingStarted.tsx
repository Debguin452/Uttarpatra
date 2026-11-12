import { t } from "@coaching-app/shared/i18n";
import { go } from "../lib/router";
import { guideHidden, hideGuide, openedLecture } from "../lib/onboarding";
import { enrolledIds } from "../lib/session";
import { SectionHead } from "./ui";

export function GettingStarted({ testDone }: { testDone: boolean }) {
  const steps = [
    { label: "guide_profile", done: true, target: "profile" },
    { label: "guide_lecture", done: openedLecture.value, target: "batches" },
    { label: "guide_test", done: testDone, target: "tests" },
    { label: "guide_enroll", done: enrolledIds().size > 0, target: "batches" },
  ];

  if (guideHidden.value || steps.every((s) => s.done)) return null;

  return (
    <section class="stack">
      <SectionHead
        title={t("guide_title")}
        action={
          <button class="btn small quiet" onClick={hideGuide}>
            {t("guide_hide")}
          </button>
        }
      />
      <div class="list">
        {steps.map((step) => (
          <button class="item" disabled={step.done} onClick={() => go(step.target)}>
            <span class={step.done ? "name muted" : "name"}>{t(step.label)}</span>
            <span class="side">
              <span class={step.done ? "badge mark" : "badge"}>{step.done ? t("guide_done") : t("guide_go")}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
