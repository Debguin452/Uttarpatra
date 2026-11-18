import { useState } from "preact/hooks";
import { t } from "@coaching-app/shared/i18n";
import { IconMore } from "@coaching-app/ui/icons";
import { go } from "../lib/router";
import { AvatarSheet } from "./AvatarSheet";
import { Sheet } from "./ui";

// The three-dot menu on the profile: change picture, edit details.
export function ProfileMenu({ avatarOpen, onAvatarClose }: { avatarOpen: boolean; onAvatarClose: () => void; }) {
  const [open, setOpen] = useState(false);
  const [picture, setPicture] = useState(false);

  return (
    <>
      <button class="btn small quiet icon-btn" aria-label={t("more_options")} aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <IconMore size={20} />
      </button>
      {open && (
        <Sheet onClose={() => setOpen(false)}>
          <div class="list">
            <button
              class="item"
              onClick={() => {
                setOpen(false);
                setPicture(true);
              }}
            >
              <span class="name">{t("avatar_change")}</span>
            </button>
            <button
              class="item"
              onClick={() => {
                setOpen(false);
                go("profile/edit");
              }}
            >
              <span class="name">{t("edit_details")}</span>
            </button>
          </div>
        </Sheet>
      )}
      {(picture || avatarOpen) && (
        <AvatarSheet
          onClose={() => {
            setPicture(false);
            onAvatarClose();
          }}
        />
      )}
    </>
  );
}
