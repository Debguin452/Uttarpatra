import type { ComponentChildren } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { t } from "@coaching-app/shared/i18n";
import { ago } from "../lib/format";

export function Splash() {
  return (
    <div class="splash">
      <div class="spinner" role="status" aria-label={t("loading")} />
    </div>
  );
}

export function Loading() {
  return <div class="spinner" role="status" aria-label={t("loading")} />;
}

type Query<T> = { data: T | null; isLoading: boolean; refetch: () => void };

export function Async<T>({
  q,
  children,
  loading,
}: {
  q: Query<T>;
  children: (data: T) => ComponentChildren;
  /** Override the default row-skeleton for content that isn't
   *  list-shaped (pass `<Loading />` to go back to the plain spinner,
   *  or a custom skeleton matching the screen's actual layout). */
  loading?: ComponentChildren;
}) {
  if (q.data) return <>{children(q.data)}</>;
  if (q.isLoading) return <>{loading ?? <SkeletonList />}</>;
  return (
    <div class="stack">
      <p class="error-text">{t("something_wrong")}</p>
      <button class="btn small quiet" onClick={q.refetch}>
        {t("retry")}
      </button>
    </div>
  );
}

export function SyncNote({ syncedAt, isStale }: { syncedAt: number | null; isStale: boolean }) {
  if (!syncedAt) return null;
  return <p class="hint">{isStale ? t("offline_notice") : ago(syncedAt)}</p>;
}

export function Sheet({ children, onClose }: { children: ComponentChildren; onClose?: () => void }) {
  return (
    <div class="sheet-backdrop" onClick={onClose}>
      <div class="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

/**
 * Counts up to `value` once on mount — a result screen is the one
 * place a brief, purposeful flourish earns its keep (the number is
 * the whole point of the screen). Skips straight to the final value
 * for prefers-reduced-motion, and for every other number in the app:
 * this isn't a general-purpose "make numbers exciting" widget.
 */
export function CountUp({ value, durationMs = 700 }: { value: number; durationMs?: number }) {
  const [shown, setShown] = useState(() =>
    typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches ? value : 0,
  );
  const start = useRef<number | null>(null);

  useEffect(() => {
    if (shown === value) return;
    if (typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(value);
      return;
    }
    start.current = null;
    let frame: number;
    const step = (ts: number) => {
      if (start.current === null) start.current = ts;
      const progress = Math.min(1, (ts - start.current) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setShown(Math.round(eased * value));
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <>{shown}</>;
}

/** A one-shot drawn checkmark for a just-completed action (sent,
 *  submitted, approved). Draws the circle then the tick; a repeat of
 *  the same success doesn't need to re-draw, so pair it with text
 *  that only appears once, not a status that stays on screen. */
export function AnimatedCheck({ size = 40 }: { size?: number }) {
  return (
    <svg
      class="check-pop"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--mark)"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="11" />
      <path d="M7 12.5l3.5 3.5L17 9" />
    </svg>
  );
}

/** Icon + message for a list/section with nothing in it. Swaps in
 *  wherever a screen was just showing a bare muted sentence — same
 *  message, a little less dead-feeling. */
export function EmptyState({ icon, text }: { icon: ComponentChildren; text: string }) {
  return (
    <div class="empty-state">
      {icon}
      <p class="muted small">{text}</p>
    </div>
  );
}

/** A handful of list-row-shaped placeholders — the default loading
 *  state for Async below. Shape-matched to "a list of items", which
 *  covers most of what Async wraps; a screen whose content looks
 *  nothing like a list can still pass its own `loading` node. */
export function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <div class="skeleton-list" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div class="skeleton-row" key={i}>
          <div>
            <div class="skeleton-line" style={{ "--w": "70%" }} />
            <div class="skeleton-line" style={{ "--w": "40%" }} />
          </div>
          <div class="skeleton-side skeleton-block" style={{ "--w": "18px", "--h": "18px" }} />
        </div>
      ))}
    </div>
  );
}

export function SectionHead({ title, action }: { title: string; action?: ComponentChildren }) {
  return (
    <div class="section-head">
      <h2>{title}</h2>
      {action}
    </div>
  );
}
