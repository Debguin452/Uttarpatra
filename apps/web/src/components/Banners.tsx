import { useEffect, useState } from "preact/hooks";
import { pick } from "../lib/format";
import { useBanners } from "../lib/queries";
import { go } from "../lib/router";
import type { PublicBanner } from "../lib/types";

// Admin-entered URLs are untrusted: only https links leave the app.
function externalHref(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? parsed.href : null;
  } catch {
    return null;
  }
}

function open(banner: PublicBanner) {
  if (banner.batch_id) return go(`batches/${banner.batch_id}`);
  const href = externalHref(banner.link_url);
  if (href) window.open(href, "_blank", "noopener,noreferrer");
}

const actionable = (b: PublicBanner) => Boolean(b.batch_id || externalHref(b.link_url));

export function Banners() {
  const q = useBanners();
  const rows = q.data ?? [];
  const [index, setIndex] = useState(0);
  const [broken, setBroken] = useState<Set<string>>(new Set());
  const live = rows.filter((b) => !broken.has(b.id));

  useEffect(() => {
    if (live.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % live.length), 6000);
    return () => clearInterval(timer);
  }, [live.length]);

  // Nothing to show (loading, offline with no cache, or none set up):
  // render nothing rather than an empty frame, so Home does not jump.
  if (live.length === 0) return null;
  const current = live[index % live.length]!;
  const title = pick(current, "title");

  return (
    <section class="promo" aria-roledescription="carousel" aria-label={title}>
      {actionable(current) ? (
        <button class="promo-frame" onClick={() => open(current)}>
          <img src={current.image_url} alt={title} onError={() => setBroken(new Set(broken).add(current.id))} />
        </button>
      ) : (
        <div class="promo-frame">
          <img src={current.image_url} alt={title} onError={() => setBroken(new Set(broken).add(current.id))} />
        </div>
      )}
      {live.length > 1 && (
        <div class="promo-dots" role="group">
          {live.map((b, i) => (
            <button
              key={b.id}
              class="promo-dot"
              aria-label={pick(b, "title")}
              aria-current={i === index % live.length}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
