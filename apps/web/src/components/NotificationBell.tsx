import { useEffect, useState } from "preact/hooks";
import { t } from "@coaching-app/shared/i18n";
import { IconBell } from "@coaching-app/ui/icons";
import { pick, when } from "../lib/format";
import { inbox, markAllRead, markRead, refreshInbox } from "../lib/notifications";
import { go } from "../lib/router";
import { Sheet } from "./ui";

// The bell with an unread count, and the inbox it opens. Used by students,
// teachers and admins: what shows up is decided by the server from who they are.
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  useEffect(() => void refreshInbox(), []);
  useEffect(() => {
    const onVisible = () => document.visibilityState === "visible" && void refreshInbox();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  const data = inbox.value;
  const unread = data?.unread ?? 0;

  function show() {
    setOpen(true);
    void refreshInbox(true);
  }
  function close() {
    setOpen(false);
    void markAllRead();
  }

  return (
    <>
      <button class="btn small quiet icon-btn bell" aria-label={unread > 0 ? t("notif_bell_unread", { n: unread }) : t("notif_title")} onClick={show}>
        <IconBell size={22} />
        {unread > 0 && <span class="bell-count">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <Sheet onClose={close}>
          <h2 class="subtitle">{t("notif_title")}</h2>
          {!data && <p class="muted small">{t("loading")}</p>}
          {data && data.items.length === 0 && <p class="muted small">{t("notif_empty")}</p>}
          <div class="list">
            {(data?.items ?? []).map((n) => (
              <button
                class="item"
                key={n.id}
                onClick={() => {
                  void markRead(n.id);
                  if (n.link) {
                    setOpen(false);
                    go(n.link);
                  }
                }}
              >
                <span class="name">
                  {!n.read && <span class="unread-dot" aria-label={t("notif_new")} />}
                  {pick(n, "title")}
                </span>
                <span class="meta">
                  {[pick(n, "body"), n.sender_name, when(n.created_at)].filter(Boolean).join(" · ")}
                </span>
              </button>
            ))}
          </div>
          <button class="btn block quiet" onClick={close}>
            {t("close")}
          </button>
        </Sheet>
      )}
    </>
  );
}
