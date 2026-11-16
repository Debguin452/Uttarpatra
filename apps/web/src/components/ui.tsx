import type { ComponentChildren } from "preact";
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

export function Skeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div class="skeleton-list" role="status" aria-label={t("loading")}>
      {Array.from({ length: rows }, (_, i) => (
        <div class="skeleton-row" key={i}>
          <span class="skeleton-line" style={{ width: `${70 - (i % 3) * 12}%` }} />
          <span class="skeleton-line short" />
        </div>
      ))}
    </div>
  );
}

export function Async<T>({ q, children }: { q: Query<T>; children: (data: T) => ComponentChildren }) {
  if (q.data) return <>{children(q.data)}</>;
  if (q.isLoading) return <Skeleton />;
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

export function SectionHead({ title, action }: { title: string; action?: ComponentChildren }) {
  return (
    <div class="section-head">
      <h2>{title}</h2>
      {action}
    </div>
  );
}
