import { signal, computed } from "@preact/signals";
import en from "./en.json";
import bn from "./bn.json";

export type Locale = "en" | "bn";
export const SUPPORTED_LOCALES: Locale[] = ["en", "bn"];
const DICTS: Record<Locale, Record<string, string>> = { en, bn };

const STORAGE_KEY = "lang";

function detectInitialLocale(): Locale {
  // Explicit choice always wins. Absent that, English is the default
  // regardless of device language — the brief asks for English-first
  // with Bengali as an opt-in, not browser-language auto-detection,
  // since a device set to Bengali doesn't mean the student wants the
  // app's UI in Bengali (many read English UI but think in Bengali).
  if (typeof localStorage !== "undefined") {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "bn") return saved;
  }
  return "en";
}

export const locale = signal<Locale>(detectInitialLocale());

export function setLocale(next: Locale) {
  locale.value = next;
  if (typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, next);
  if (typeof document !== "undefined") {
    document.documentElement.lang = next;
    // Bengali body copy reads better with more breathing room; this is
    // the one place the token system's line-height changes per locale.
    document.documentElement.style.setProperty(
      "--leading-normal",
      next === "bn" ? "1.65" : "1.5",
    );
  }
}

const dict = computed(() => DICTS[locale.value]);

/** t("key", {placeholder: value}) — plain, no ICU plural rules needed
 *  yet since every current string has at most one numeric slot. */
export function t(key: string, vars?: Record<string, string | number>): string {
  let str = dict.value[key] ?? DICTS.en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(`{${k}}`, String(v));
    }
  }
  return str;
}

export function useLocale() {
  return { locale: locale.value, setLocale, t };
}
