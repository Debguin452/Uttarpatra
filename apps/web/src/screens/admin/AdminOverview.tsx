import { t } from "@coaching-app/shared/i18n";
import type { AnalyticsOverview } from "@coaching-app/shared/analytics";
import { SectionHead, Loading } from "../../components/ui";
import { api } from "../../lib/api";
import type { AdminTeacherApplication } from "../../lib/types";
import { useLoad } from "../../lib/useLoad";

export function AdminOverview({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const overview = useLoad(() => api<AnalyticsOverview>("/api/admin/analytics/overview"));
  // Teacher applications are a super-admin-only API — support sees the rest
  // of this overview but not this one card (same restriction as AdminPeople's
  // "Teachers" sub-tab).
  const applications = useLoad(
    () => (isSuperAdmin ? api<AdminTeacherApplication[]>("/api/admin/teacher-applications") : Promise.resolve([])),
    [isSuperAdmin],
  );

  const d = overview.data;
  const loading = overview.loading && !d;

  return (
    <div class="stack">
      <h1 class="title">{t("admin_tab_overview")}</h1>
      {overview.error && <p class="error-text">{overview.error}</p>}
      {loading && <Loading />}

      {d && (
        <>
          <section class="stack">
            <div class="stats">
              <a class="item" href="#/admin/payments">
                <strong>{d.revenue.pendingCount}</strong>
                <span class="small muted">{t("admin_overview_pending_payments")}</span>
              </a>
              {isSuperAdmin && (
                <a class="item" href="#/admin/people">
                  <strong>{applications.data?.length ?? (applications.loading ? "—" : 0)}</strong>
                  <span class="small muted">{t("admin_overview_pending_applications")}</span>
                </a>
              )}
              <div class="item">
                <strong>{d.doubts.open}</strong>
                <span class="small muted">{t("admin_overview_open_doubts")}</span>
              </div>
            </div>
          </section>

          <section class="stack">
            <SectionHead title={t("admin_overview_students")} />
            <div class="stats">
              <div>
                <strong>{d.students.total}</strong>
                <span class="small muted">{t("admin_overview_total")}</span>
              </div>
              <div>
                <strong>{d.students.active}</strong>
                <span class="small muted">{t("admin_overview_active")}</span>
              </div>
              <div>
                <strong>{d.students.newLast7Days}</strong>
                <span class="small muted">{t("admin_overview_new_7d")}</span>
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
        </>
      )}
    </div>
  );
}
