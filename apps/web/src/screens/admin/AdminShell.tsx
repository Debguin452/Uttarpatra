import { t } from "@coaching-app/shared/i18n";
import { LangToggle } from "../../components/LangToggle";
import { Logo } from "../../components/Logo";
import { currentRole, logOut, me } from "../../lib/session";
import { segments } from "../../lib/router";
import { AdminPayments } from "../Admin";
import { Profile } from "../Profile";
import { Register } from "../Register";
import { AdminBatchesShell } from "./AdminBatchesShell";
import { AdminOverview } from "./AdminOverview";
import { AdminPeople } from "./AdminPeople";
import { AdminSettingsShell } from "./AdminSettingsShell";

const TABS = [
  { id: "overview", label: "admin_tab_overview", superOnly: false },
  { id: "people", label: "admin_tab_people", superOnly: false },
  { id: "batches", label: "admin_tab_batches", superOnly: false },
  { id: "payments", label: "admin_tab_payments", superOnly: false },
  { id: "settings", label: "admin_tab_settings", superOnly: false },
] as const;

export function AdminShell() {
  const [head, tab, sub] = segments();
  const role = currentRole();
  const isSuper = role === "super_admin";
  const name = me.value && me.value.registered ? me.value.user.name : "";
  const visible = TABS.filter((entry) => isSuper || !entry.superOnly);
  const onProfile = head === "profile";
  // "analytics" is reachable as a deep link (from the Overview screen's "see
  // all") without being its own sidebar item - it lives inside Settings now.
  const current = onProfile
    ? "profile"
    : tab === "analytics" && isSuper
      ? "analytics"
      : (visible.find((entry) => entry.id === tab)?.id ?? "overview");

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
          <a href="#/profile" class="small">
            {name}
          </a>
        </div>
        <nav class="admin-tabs" aria-label="Admin">
          {links}
        </nav>
      </header>

      <main class="admin-main">
        {current === "overview" && <AdminOverview isSuperAdmin={isSuper} />}
        {current === "people" && <AdminPeople isSuperAdmin={isSuper} />}
        {current === "batches" && <AdminBatchesShell batchId={sub} />}
        {current === "payments" && (
          <>
            <h1 class="title">{t("admin_tab_payments")}</h1>
            <AdminPayments />
          </>
        )}
        {(current === "settings" || current === "analytics") && (
          <AdminSettingsShell key={current} isSuperAdmin={isSuper} initialSub={current === "analytics" ? "analytics" : "notices"} />
        )}
        {current === "profile" && (tab === "edit" ? <Register mode="edit" /> : (
          <div class="stack">
            <LangToggle />
            <Profile />
          </div>
        ))}
      </main>
    </div>
  );
}
