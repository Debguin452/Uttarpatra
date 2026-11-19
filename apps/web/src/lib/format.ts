import { locale, t } from "@coaching-app/shared/i18n";

export function pick(row: object, base: string): string {
  const record = row as Record<string, unknown>;
  const bn = record[`${base}_bn`];
  const en = record[`${base}_en`];
  const preferred = locale.value === "bn" ? bn : en;
  return String(preferred ?? en ?? bn ?? "");
}

export function money(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export function clock(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return t("greeting_morning");
  if (hour < 17) return t("greeting_afternoon");
  return t("greeting_evening");
}

export function ago(timestamp: number): string {
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
  if (minutes < 1) return t("synced_just_now");
  const label = minutes < 60 ? `${minutes}m` : `${Math.round(minutes / 60)}h`;
  return t("synced_ago", { time: label });
}

export function when(unixSec: number): string {
  return new Date(unixSec * 1000).toLocaleString(locale.value === "bn" ? "bn-IN" : "en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function errorText(code: string): string {
  if (code === "payment_pending") return t("payment_pending_exists");
  if (code === "network") return t("offline_notice");
  if (["rate_limited", "utr_already_used", "coupon_invalid", "already_submitted", "already_staff", "already_reviewed", "invalid_subject", "batch_id_taken", "subject_id_taken", "not_a_teacher", "batch_not_found", "not_found", "cannot_change_self", "not_your_batch", "already_enrolled", "turnstile_failed", "invalid_input", "batch_is_free", "batch_not_free"].includes(code)) return t(code);
  // Unknown code: say so, with the code, so a failure can be traced instead of guessed at.
  return code === "unknown" ? t("something_wrong") : `${t("something_wrong")} (${code})`;
}
