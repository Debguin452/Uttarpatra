// Profile picture: a photo the person chose, one of the built-in avatars
// ("preset:owl"), or their initial when neither is set.
export const AVATAR_PRESETS = [
  { id: "owl", glyph: "🦉", bg: "#E9DDBF" },
  { id: "book", glyph: "📚", bg: "#C9DCEB" },
  { id: "atom", glyph: "⚛️", bg: "#D3E8D5" },
  { id: "flask", glyph: "🧪", bg: "#EBD0D6" },
  { id: "dna", glyph: "🧬", bg: "#DAD3EC" },
  { id: "rocket", glyph: "🚀", bg: "#F0D9C4" },
  { id: "target", glyph: "🎯", bg: "#EBC9C9" },
  { id: "star", glyph: "🌟", bg: "#EFE6B8" },
] as const;

export function Avatar({ photo, name, size = 48 }: { photo?: string | null; name?: string | null; size?: number }) {
  const box = { width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size * 0.5)}px` };

  if (photo?.startsWith("data:image/") || photo?.startsWith("https://")) {
    return <img class="avatar" style={box} src={photo} alt="" />;
  }
  const preset = photo?.startsWith("preset:") ? AVATAR_PRESETS.find((p) => `preset:${p.id}` === photo) : undefined;
  if (preset) {
    return (
      <span class="avatar" style={{ ...box, background: preset.bg }} aria-hidden="true">
        {preset.glyph}
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
