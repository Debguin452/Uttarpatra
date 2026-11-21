import { useState } from "preact/hooks";
import { t } from "@coaching-app/shared/i18n";
import { AdminAnalytics } from "./AdminAnalytics";
import { AdminBanners } from "./AdminBanners";
import { AdminCoupons } from "./AdminCoupons";
import { AdminNotices } from "./AdminNotices";
import { AdminSubjects } from "./AdminSubjects";

type Sub = "notices" | "banners" | "coupons" | "subjects" | "analytics";

export function AdminSettingsShell({ isSuperAdmin, initialSub = "notices" }: { isSuperAdmin: boolean; initialSub?: Sub }) {
  const [sub, setSub] = useState<Sub>(initialSub);
  // Subjects and Analytics are super-admin-only APIs, so support never gets
  // those sub-tabs (matches the old sidebar, where both whole tabs were
  // hidden from support).
  const subs: { id: Sub; label: string }[] = [
    { id: "notices", label: "admin_settings_tab_notices" },
    { id: "banners", label: "admin_settings_tab_banners" },
    { id: "coupons", label: "admin_settings_tab_coupons" },
    ...(isSuperAdmin ? ([{ id: "subjects", label: "admin_settings_tab_subjects" }] as const) : []),
    ...(isSuperAdmin ? ([{ id: "analytics", label: "admin_tab_analytics" }] as const) : []),
  ];

  return (
    <div class="stack">
      <h1 class="title">{t("admin_tab_settings")}</h1>
      <div class="seg" role="tablist">
        {subs.map((entry) => (
          <button role="tab" aria-selected={sub === entry.id} onClick={() => setSub(entry.id)}>
            {t(entry.label)}
          </button>
        ))}
      </div>
      {sub === "notices" && <AdminNotices />}
      {sub === "banners" && <AdminBanners />}
      {sub === "coupons" && <AdminCoupons />}
      {sub === "subjects" && isSuperAdmin && <AdminSubjects />}
      {sub === "analytics" && isSuperAdmin && <AdminAnalytics />}
    </div>
  );
}
