import type { ComponentChildren } from "preact";
import { t } from "@coaching-app/shared/i18n";
import { go } from "../lib/router";
import { Logo } from "./Logo";

/**
 * Shared chrome for Privacy and Terms: both need the same back-nav,
 * title block, and a body styled like a page of ruled paper being read
 * rather than a marketing page. Kept deliberately plain — no cards, no
 * icons competing with the text — since the point of this screen is to
 * be read carefully, not skimmed.
 */
export function LegalPage({
  titleKey,
  updated,
  children,
}: {
  titleKey: string;
  /** ISO date string, e.g. "2026-11-16" — shown so a parent or student
   *  can tell at a glance whether they've already seen this version. */
  updated: string;
  children: ComponentChildren;
}) {
  return (
    <main class="screen legal">
      <button class="btn quiet small legal-back" onClick={() => history.length > 1 ? history.back() : go("home")}>
        {t("back")}
      </button>
      <header class="stack">
        <Logo width={96} start />
        <h1 class="title">{t(titleKey)}</h1>
        <p class="muted small">
          {t("legal_updated")}: {updated}
        </p>
      </header>
      <div class="legal-body ruled">{children}</div>
    </main>
  );
}
