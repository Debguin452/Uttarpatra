import { useState } from "preact/hooks";
import { t } from "@coaching-app/shared/i18n";
import { api } from "../lib/api";
import { compressAvatar } from "../lib/compressAvatar";
import { loadMe, me } from "../lib/session";
import { AVATAR_PRESETS, Avatar } from "./Avatar";

export function AvatarPicker() {
  const user = me.value && me.value.registered ? me.value.user : null;
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!user) return null;

  async function save(photo: string | null) {
    setBusy(true);
    setFailed(false);
    try {
      await api("/api/me/avatar", { method: "PUT", body: { photo } });
      await loadMe();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  async function upload(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    try {
      await save(await compressAvatar(file));
    } catch {
      setFailed(true);
    }
  }

  return (
    <div class="stack">
      <div class="avatar-picker-head">
        <Avatar photo={user.photo_url} name={user.name} size={64} />
        <div class="avatar-actions">
          <label class="btn small">
            {t("avatar_upload")}
            <input type="file" accept="image/*" hidden disabled={busy} onChange={upload} />
          </label>
          {user.photo_url && (
            <button class="btn small quiet" disabled={busy} onClick={() => save(null)}>
              {t("avatar_remove")}
            </button>
          )}
        </div>
      </div>
      <p class="hint">{t("avatar_choose")}</p>
      <div class="avatar-grid" role="group">
        {AVATAR_PRESETS.map((p) => (
          <button
            key={p.id}
            class="avatar-choice"
            aria-label={p.id}
            aria-pressed={user.photo_url === `preset:${p.id}`}
            disabled={busy}
            onClick={() => save(`preset:${p.id}`)}
          >
            <Avatar photo={`preset:${p.id}`} size={44} />
          </button>
        ))}
      </div>
      {failed && <p class="error-text">{t("something_wrong")}</p>}
    </div>
  );
}
