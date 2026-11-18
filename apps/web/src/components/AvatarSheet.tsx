import { useEffect, useState } from "preact/hooks";
import { t } from "@coaching-app/shared/i18n";
import { segments } from "../lib/router";
import { me, uid } from "../lib/session";
import { AvatarPicker } from "./AvatarPicker";
import { Sheet } from "./ui";

// The picture editor, as a sheet: opened from the profile menu or by tapping
// the picture, and offered once, the first time someone signs in.
export function AvatarSheet({ onClose, first = false }: { onClose: () => void; first?: boolean }) {
  return (
    <Sheet onClose={onClose}>
      <h2 class="subtitle">{first ? t("avatar_first_title") : t("avatar_title")}</h2>
      {first && <p class="muted small">{t("avatar_first_hint")}</p>}
      <AvatarPicker onSaved={onClose} />
      <button class="btn block quiet" onClick={onClose}>
        {first ? t("avatar_skip") : t("close")}
      </button>
    </Sheet>
  );
}

const promptedKey = (userId: string) => `avatar-prompted:${userId}`;

// Shows the sheet once per person, on the first visit with no picture set.
// Never over a running test, and never again after it has been shown.
export function AvatarFirstRun() {
  const user = me.value && me.value.registered ? me.value.user : null;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user || user.photo_url) return;
    if (segments()[0] === "tests" && segments()[1]) return;
    try {
      const key = promptedKey(uid());
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch {
      return;
    }
    setOpen(true);
  }, [user?.name]);

  return open ? <AvatarSheet first onClose={() => setOpen(false)} /> : null;
}
