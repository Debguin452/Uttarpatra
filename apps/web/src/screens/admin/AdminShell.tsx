import { t } from "@coaching-app/shared/i18n";
import { Logo } from "../../components/Logo";
import { NotificationBell } from "../../components/NotificationBell";
import { currentRole, logOut, me } from "../../lib/session";
import { segments } from "../../lib/router";
import { AdminPayments, AdminUsers } from "../Admin";
import { AdminTeachers } from "../AdminTeachers";
import { Profile } from "../Profile";
import { Register } from "../Register";
import { AdminAnalytics } from "./AdminAnalytics";
import { AdminBanners } from "./AdminBanners";
import { AdminBatchEditor, AdminBatches } from "./AdminBatches";
import { AdminChapters } from "./AdminChapters";
import { AdminCoupons } from "./AdminCoupons";
import { AdminDoubts } from "./AdminDoubts";
import { AdminLectures } from "./AdminLectures";
import { AdminMaterials } from "./AdminMaterials";
import { AdminNotices } from "./AdminNotices";
import { AdminNotifications } from "./AdminNotifications";
import { AdminSubjects } from "./AdminSubjects";
import { AdminTests } from "./AdminTests";

const TABS = [
  { id: "payments", label: "admin_tab_payments", superOnly: false },
  { id: "users", label: "admin_tab_users", superOnly: false },
  { id: "batches", label: "admin_tab_batches", superOnly: false },
  { id: "lectures", label: "admin_tab_lectures", superOnly: false },
  { id: "chapters", label: "admin_tab_chapters", superOnly: false },
  { id: "materials", label: "admin_tab_materials", superOnly: false },
  { id: "tests", label: "admin_tab_tests", superOnly: false },
  { id: "coupons", label: "admin_tab_coupons", superOnly: false },
  { id: "doubts", label: "admin_tab_doubts", superOnly: false },
  { id: "notices", label: "admin_tab_notices", superOnly: false },
  { id: "notifications", label: "admin_tab_notifications", superOnly: false },
  { id: "banners", label: "admin_tab_banners", superOnly: false },
  { id: "teachers", label: "admin_tab_teachers", superOnly: true },
  { id: "subjects", label: "admin_tab_subjects", superOnly: true },
  { id: "analytics", label: "admin_tab_analytics", superOnly: true },
] as const;

export function AdminShell() {
  const [head, tab, sub] = segments();
  const role = currentRole();
  const isSuper = role === "super_admin";
  const name = me.value && me.value.registered ? me.value.user.name : "";
  const visible = TABS.filter((entry) => isSuper || !entry.superOnly);
  const onProfile = head === "profile";
  const current = onProfile ? "profile" : (visible.find((entry) => entry.id === tab)?.id ?? "payments");

  const links = visible.map((entry) => (
    <a href={`#/admin/${entry.id}`} aria-current={current === entry.id ? "page" : undefined}>
      {t(entry.label)}
    </a>
  ));

  return (
    <div class="admin">
      <aside class="admin-side">
        <div class="stack">
          <Logo width={176} start />
          <strong class="eyebrow">{t("admin_console")}</strong>
          <nav aria-label="Admin">{links}</nav>
        </div>
        <div class="stack">
          <NotificationBell />
          <a href="#/profile" class="who" aria-current={onProfile ? "page" : undefined}>
            <strong>{name}</strong>
            <span class="small muted">{t(`role_${role}`)}</span>
          </a>
          <button class="btn small quiet" onClick={logOut}>
            {t("sign_out")}
          </button>
        </div>
      </aside>

      <header class="admin-top">
        <div class="row-between">
          <span class="brand-row">
            <Logo width={46} start />
            <strong class="brand">{t("admin_console")}</strong>
          </span>
          <span class="row-inline">
            <NotificationBell />
            <a href="#/profile" class="small">
              {name}
            </a>
          </span>
        </div>
        <nav class="admin-tabs" aria-label="Admin">
          {links}
        </nav>
      </header>

      <main class="admin-main">
        {current === "payments" && (
          <>
            <h1 class="title">{t("admin_tab_payments")}</h1>
            <AdminPayments />
          </>
        )}
        {current === "users" && (
          <>
            <h1 class="title">{t("admin_tab_users")}</h1>
            <AdminUsers isSuperAdmin={isSuper} />
          </>
        )}
        {current === "batches" && (sub ? <AdminBatchEditor id={sub} /> : <AdminBatches />)}
        {current === "lectures" && <AdminLectures />}
        {current === "chapters" && <AdminChapters />}
        {current === "materials" && <AdminMaterials />}
        {current === "tests" && <AdminTests />}
        {current === "coupons" && <AdminCoupons />}
        {current === "doubts" && <AdminDoubts />}
        {current === "notices" && <AdminNotices />}
        {current === "notifications" && (
          <>
            <h1 class="title">{t("admin_tab_notifications")}</h1>
            <AdminNotifications />
          </>
        )}
        {current === "banners" && <AdminBanners />}
        {current === "teachers" && (
          <>
            <h1 class="title">{t("admin_tab_teachers")}</h1>
            <AdminTeachers />
          </>
        )}
        {current === "subjects" && <AdminSubjects />}
        {current === "analytics" && <AdminAnalytics />}
        {current === "profile" && (tab === "edit" ? <Register mode="edit" /> : <Profile />)}
      </main>
    </div>
  );
}
