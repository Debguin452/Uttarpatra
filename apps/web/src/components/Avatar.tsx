import type { JSX } from "preact";
import {
  IconBatches,
  IconBell,
  IconClock,
  IconPlay,
  IconSearch,
  IconStreak,
  IconTest,
  IconTrophy,
} from "@coaching-app/ui/icons";

// Built-in avatars: the app's own line icons on flat tiles. The ink stays
// dark in both themes because the tiles are always light.
type Icon = (props: { size?: number }) => JSX.Element;
export const AVATAR_PRESETS: { id: string; Icon: Icon; bg: string }[] = [
  { id: "batches", Icon: IconBatches, bg: "#E9DDBF" },
  { id: "test", Icon: IconTest, bg: "#C9DCEB" },
  { id: "trophy", Icon: IconTrophy, bg: "#EFE6B8" },
  { id: "streak", Icon: IconStreak, bg: "#F0D9C4" },
  { id: "bell", Icon: IconBell, bg: "#EBD0D6" },
  { id: "clock", Icon: IconClock, bg: "#D3E8D5" },
  { id: "play", Icon: IconPlay, bg: "#DAD3EC" },
  { id: "search", Icon: IconSearch, bg: "#EBC9C9" },
];

export function Avatar({ photo, name, size = 48 }: { photo?: string | null; name?: string | null; size?: number }) {
  const box = { width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size * 0.45)}px` };

  if (photo?.startsWith("data:image/") || photo?.startsWith("https://")) {
    return <img class="avatar" style={box} src={photo} alt="" />;
  }
  const preset = photo?.startsWith("preset:") ? AVATAR_PRESETS.find((p) => `preset:${p.id}` === photo) : undefined;
  if (preset) {
    return (
      <span class="avatar" style={{ ...box, background: preset.bg, color: "#1b1e26" }} aria-hidden="true">
        <preset.Icon size={Math.round(size * 0.52)} />
      </span>
    );
  }
  const initial = (name ?? "").trim().charAt(0).toUpperCase() || "?";
  return (
    <span class="avatar initial" style={box} aria-hidden="true">
      {initial}
    </span>
  );
}
