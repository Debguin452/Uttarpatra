import { useState } from "preact/hooks";
import { t } from "@coaching-app/shared/i18n";
import { AdminUsers } from "../Admin";
import { AdminTeachers } from "../AdminTeachers";

export function AdminPeople({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [sub, setSub] = useState<"users" | "teachers">("users");
  // Teacher applications, the active-teacher list and invites are super-admin-only
  // APIs, so support never gets a "Teachers" sub-tab to click into (matches the
  // old sidebar, where that whole tab was hidden from support).
  const showTeachers = isSuperAdmin;

  return (
    <div class="stack">
      <h1 class="title">{t("admin_tab_people")}</h1>
      {showTeachers && (
        <div class="seg" role="tablist">
          <button role="tab" aria-selected={sub === "users"} onClick={() => setSub("users")}>
            {t("admin_people_tab_users")}
          </button>
          <button role="tab" aria-selected={sub === "teachers"} onClick={() => setSub("teachers")}>
            {t("admin_people_tab_teachers")}
          </button>
        </div>
      )}
      {showTeachers && sub === "teachers" ? <AdminTeachers /> : <AdminUsers isSuperAdmin={isSuperAdmin} />}
    </div>
  );
}
