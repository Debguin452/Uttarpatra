import { t } from "@coaching-app/shared/i18n";
import { Avatar } from "../components/Avatar";
import { AvatarPicker } from "../components/AvatarPicker";
import { LangToggle } from "../components/LangToggle";
import { Async, SectionHead } from "../components/ui";
import { money, pick } from "../lib/format";
import { useBatches, usePayments } from "../lib/queries";
import { go } from "../lib/router";
import { logOut, me } from "../lib/session";
import { setTheme, theme, type Theme } from "../lib/theme";

const THEMES: { id: Theme; label: string }[] = [
  { id: "system", label: "theme_system" },
  { id: "light", label: "theme_light" },
  { id: "dark", label: "theme_dark" },
];

export function Profile() {
  const payments = usePayments();
  const batches = useBatches();
  const user = me.value && me.value.registered ? me.value.user : null;
  const titles = new Map((batches.data ?? []).map((b) => [b.id, pick(b, "title")]));

  return (
    <div class="screen">
      <header class="row-between">
        <div class="avatar-head">
          <Avatar photo={user?.photo_url} name={user?.name} size={56} />
          <div class="stack">
            <h1 class="title">{user?.name}</h1>
            <p class="muted small">{[user?.phone, user?.board, user?.school].filter(Boolean).join(" · ")}</p>
          </div>
        </div>
        <button class="btn small quiet" onClick={() => go("profile/edit")}>
          {t("edit")}
        </button>
      </header>

      <section class="stack">
        <SectionHead title={t("avatar_title")} />
        <AvatarPicker />
      </section>

      <section class="stack">
        <SectionHead title={t("language")} />
        <LangToggle />
      </section>

      <section class="stack">
        <SectionHead title={t("theme")} />
        <div class="chips" role="group">
          {THEMES.map(({ id, label }) => (
            <button class="chip" aria-pressed={theme.value === id} onClick={() => setTheme(id)}>
              {t(label)}
            </button>
          ))}
        </div>
      </section>

      <section class="stack">
        <SectionHead title={t("payment_history")} />
        <Async q={payments}>
          {(rows) =>
            rows.length === 0 ? (
              <p class="muted small">—</p>
            ) : (
              <div class="list">
                {rows.map((p) => (
                  <div class="item">
                    <span class="name">{titles.get(p.batch_id) ?? p.batch_id}</span>
                    <span class="meta">{money(p.amount_paise)}</span>
                    <span class="side">
                      <span class={p.status === "approved" ? "badge mark" : p.status === "rejected" ? "badge error" : "badge"}>
                        {t(`status_${p.status}`)}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            )
          }
        </Async>
      </section>

      {user && ["student", "teacher"].includes(user.role) && (
        <section class="stack">
          <SectionHead title={t("teach_title")} />
          <button class="btn block" onClick={() => go("teach")}>
            {user.role === "teacher" ? t("teach_area") : t("teach_cta")}
          </button>
        </section>
      )}

      {user && ["support", "super_admin"].includes(user.role) && (
        <section class="stack">
          <SectionHead title={t("admin_eyebrow")} />
          <button class="btn block" onClick={() => go("admin/payments")}>
            {t("admin_link")}
          </button>
        </section>
      )}

      <section class="stack">
        <a href="/terms.html" target="_blank" rel="noopener noreferrer" class="hint">{t("terms_title")}</a>
        <a href="/privacy.html" target="_blank" rel="noopener noreferrer" class="hint">{t("privacy_title")}</a>
      </section>

      <button class="btn danger block" onClick={logOut}>
        {t("sign_out")}
      </button>
    </div>
  );
}
