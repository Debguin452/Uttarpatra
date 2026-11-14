import { useState } from "preact/hooks";
import { t } from "@coaching-app/shared/i18n";
import type { AnalyticsOverview } from "@coaching-app/shared/analytics";
import { SectionHead, Loading } from "../../components/ui";
import { api } from "../../lib/api";
import type { AuditLogPage } from "../../lib/adminTypes";
import { money, when } from "../../lib/format";
import { useLoad } from "../../lib/useLoad";

type Overview = AnalyticsOverview & { recentSignups: { uid: string; name: string; created_at: number }[] };

function describeAudit(entry: { action: string; target: string; meta_json: string | null }): string {
  const meta = entry.meta_json ? (JSON.parse(entry.meta_json) as Record<string, unknown>) : null;
  const note = meta && typeof meta.note === "string" && meta.note ? ` — "${meta.note}"` : "";
  return `${entry.action} · ${entry.target}${note}`;
}

export function AdminAnalytics() {
  const overview = useLoad(() => api<Overview>("/api/admin/analytics/overview"));
  const [cursor, setCursor] = useState<number | null>(null);
  const [pages, setPages] = useState<AuditLogPage["entries"][]>([]);
  const log = useLoad(() => api<AuditLogPage>(`/api/admin/analytics/audit-log${cursor ? `?cursor=${cursor}` : ""}`), [cursor]);

  const allEntries = [...pages.flat(), ...(log.data?.entries ?? [])];

  function loadMore() {
    if (!log.data) return;
    setPages((p) => [...p, log.data!.entries]);
    setCursor(log.data.nextCursor);
  }

  const d = overview.data;

  return (
    <div class="stack">
      <h1 class="title">{t("admin_tab_analytics")}</h1>
      {overview.error && <p class="error-text">{overview.error}</p>}
      {overview.loading && !d && <Loading />}

      {d && (
        <>
          <section class="stack">
            <SectionHead title={t("admin_an_students")} />
            <div class="stats">
              <div>
                <strong>{d.students.total}</strong>
                <span class="small muted">{t("admin_an_total")}</span>
              </div>
              <div>
                <strong>{d.students.active}</strong>
                <span class="small muted">{t("admin_active")}</span>
              </div>
              <div>
                <strong>{d.students.blocked}</strong>
                <span class="small muted">{t("admin_blocked")}</span>
              </div>
            </div>
            <p class="small muted">{t("admin_an_new_7d", { count: d.students.newLast7Days })}</p>
          </section>

          <section class="stack">
            <SectionHead title={t("admin_an_revenue")} />
            <div class="stats">
              <div>
                <strong>{money(Math.round(d.revenue.approvedRupees * 100))}</strong>
                <span class="small muted">{t("admin_an_approved")}</span>
              </div>
              <div>
                <strong>{d.revenue.pendingCount}</strong>
                <span class="small muted">{t("admin_tab_payments")}</span>
              </div>
              <div>
                <strong>{money(Math.round(d.revenue.pendingRupees * 100))}</strong>
                <span class="small muted">{t("admin_an_pending_amount")}</span>
              </div>
            </div>
          </section>

          <section class="stack">
            <SectionHead title={t("admin_an_engagement")} />
            <div class="stats">
              <div>
                <strong>{d.tests.totalAttempts}</strong>
                <span class="small muted">{t("admin_an_attempts")}</span>
              </div>
              <div>
                <strong>{d.tests.averageScore ?? "—"}</strong>
                <span class="small muted">{t("admin_an_avg_score")}</span>
              </div>
              <div>
                <strong>{d.doubts.open}</strong>
                <span class="small muted">{t("admin_an_open_doubts")}</span>
              </div>
            </div>
          </section>

          <section class="stack">
            <SectionHead title={t("admin_an_top_batches")} />
            {d.batches.length === 0 ? (
              <p class="muted small">{t("no_batches")}</p>
            ) : (
              <div class="list">
                {d.batches.map((b) => (
                  <div class="item" key={b.batchId}>
                    <span class="name">{b.titleEn}</span>
                    <span class="meta">{t("admin_an_enrollments", { count: b.enrollments })}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section class="stack">
            <SectionHead title={t("admin_an_recent_signups")} />
            {d.recentSignups.length === 0 ? (
              <p class="muted small">{t("admin_no_results")}</p>
            ) : (
              <div class="list">
                {d.recentSignups.map((s) => (
                  <div class="item" key={s.uid}>
                    <span class="name">{s.name}</span>
                    <span class="meta">{when(s.created_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <section class="stack">
        <SectionHead title={t("admin_an_audit_log")} />
        {log.error && <p class="error-text">{log.error}</p>}
        {log.loading && allEntries.length === 0 && <Loading />}
        {allEntries.length === 0 && !log.loading && <p class="muted small">{t("admin_an_no_audit")}</p>}
        <div class="list">
          {allEntries.map((entry) => (
            <div class="item" key={entry.id}>
              <span class="name">{describeAudit(entry)}</span>
              <span class="meta">
                {entry.actor_name ?? entry.actor_uid} · {when(entry.created_at)}
              </span>
            </div>
          ))}
        </div>
        {log.data?.nextCursor && (
          <button class="btn small quiet" onClick={loadMore} disabled={log.loading}>
            {t("admin_an_load_more")}
          </button>
        )}
      </section>
    </div>
  );
}
