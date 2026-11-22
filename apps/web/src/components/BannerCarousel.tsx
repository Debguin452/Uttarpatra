import { useEffect, useRef, useState } from "preact/hooks";
import type { Banner } from "../lib/types";
import { go } from "../lib/router";
import { focusTarget } from "../lib/focus";
import { feeLabel } from "@coaching-app/shared/bannerDisplay";
import { t } from "@coaching-app/shared/i18n";
import { dateOnly } from "../lib/enrollment";
import { money, pick } from "../lib/format";
import { BannerImage } from "./BannerImage";

const AUTO_ADVANCE_MS = 5000;
const SWIPE_THRESHOLD = 0.22; // fraction of track width to commit a swipe

// Admin-entered URLs are untrusted input — only a well-formed https
// link leaves the app; anything else (javascript:, a typo, a bare
// http:) is treated as no link at all rather than risking an open
// redirect or a blocked-mixed-content dead click.
function externalHref(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? parsed.href : null;
  } catch {
    return null;
  }
}

function openBanner(b: Banner) {
  // A test starts a timed attempt the moment its page opens, so a banner
  // never jumps into one: it opens the Test Zone with that test highlighted.
  if (b.target_type === "test" && b.target_id) {
    focusTarget.value = { type: "test", id: b.target_id };
    return go("tests");
  }
  if ((b.target_type === "lecture" || b.target_type === "material") && b.target_id && b.batch_id) {
    focusTarget.value = { type: b.target_type, id: b.target_id };
    return go(`batches/${b.batch_id}`);
  }
  // "Enroll now" goes straight to the payment page; the payment page itself
  // sends someone who is already enrolled, or in a free batch, to the batch.
  if (b.batch_id && b.cta === "enroll") return go(`enroll/${b.batch_id}`);
  if (b.batch_id) return go(`batches/${b.batch_id}`);
  const href = externalHref(b.link_url);
  if (href) window.open(href, "_blank", "noopener,noreferrer");
}

// The words under a launch banner: what it is, who it is for, what it costs, when it
// starts. The batch's own details are used, so they can never disagree with the batch page.
function BannerInfo({ banner: b }: { banner: Banner }) {
  const hasBatch = Boolean(b.batch_id && b.batch_title_en);
  const fee = hasBatch ? feeLabel(b.batch_price_paise ?? 0, b.batch_mrp_paise, b.batch_kind ?? "paid") : null;
  const about = [
    b.batch_track ? t(`filter_${b.batch_track}`) : null,
    b.batch_start_date ? t("banner_starts", { date: dateOnly(b.batch_start_date) }) : null,
  ].filter(Boolean);
  const description = pick(b, "description") || (hasBatch ? pick({ summary_bn: b.batch_summary_bn, summary_en: b.batch_summary_en }, "summary") : "");

  return (
    <span class="banner-info">
      {about.length > 0 && <span class="eyebrow">{about.join(" · ")}</span>}
      <span class="banner-title">{pick(b, "title")}</span>
      {description && <span class="banner-desc">{description}</span>}
      <span class="banner-foot">
        {fee && (
          <span class="banner-fee">
            {fee.free ? (
              <strong>{t("free")}</strong>
            ) : (
              <>
                <strong>{money(fee.price)}</strong>
                {fee.mrp && (
                  <>
                    <s class="muted">{money(fee.mrp)}</s>
                    <span class="badge mark">{t("banner_off", { n: fee.off ?? 0 })}</span>
                  </>
                )}
              </>
            )}
          </span>
        )}
        {(hasBatch || b.link_url) && <span class="btn primary small banner-cta">{b.cta === "enroll" && fee && !fee.free ? t("enroll") : t("banner_view")}</span>}
      </span>
    </span>
  );
}

export function BannerCarousel({ banners }: { banners: Banner[] }) {
  const [index, setIndex] = useState(0);
  const [dragPx, setDragPx] = useState(0);
  const [broken, setBroken] = useState<ReadonlySet<string>>(new Set());
  const dragging = useRef(false);
  const startX = useRef(0);
  const moved = useRef(false); // true once a drag has moved past a tap-vs-swipe threshold
  const trackRef = useRef<HTMLDivElement>(null);

  // A banner whose image 404s (stale Drive link, deleted file) drops
  // out rather than sitting there as a broken-image icon.
  banners = banners.filter((b) => !broken.has(b.id));
  const count = banners.length;
  const clamp = (i: number) => (count === 0 ? 0 : (i + count) % count);

  // Auto-advance — paused while the user is actively dragging.
  useEffect(() => {
    if (count < 2) return;
    const id = setInterval(() => {
      if (!dragging.current) setIndex((i) => clamp(i + 1));
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  if (count === 0) return null;
  const shownIndex = index % count;

  function onPointerDown(e: PointerEvent) {
    dragging.current = true;
    moved.current = false;
    startX.current = e.clientX;
    (e.target as Element).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: PointerEvent) {
    if (!dragging.current) return;
    const delta = e.clientX - startX.current;
    if (Math.abs(delta) > 6) moved.current = true;
    setDragPx(delta);
  }
  function onPointerUp() {
    if (!dragging.current) return;
    dragging.current = false;
    const width = trackRef.current?.offsetWidth || 1;
    const fraction = dragPx / width;
    if (Math.abs(fraction) > SWIPE_THRESHOLD) {
      setIndex((i) => clamp(i + (fraction < 0 ? 1 : -1)));
    }
    setDragPx(0);
  }

  return (
    <div class="banner-carousel">
      <div class="banner-viewport">
      <div
        class="banner-track"
        ref={trackRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          transform: `translateX(calc(${-shownIndex * 100}% + ${dragPx}px))`,
          transition: dragging.current ? "none" : undefined,
        }}
      >
        {banners.map((b) => (
          <button class="banner-slide" key={b.id} onClick={() => !moved.current && openBanner(b)}>
            <BannerImage
              src={b.image_url}
              alt={pick(b, "title")}
              onFail={() => setBroken((prev) => new Set(prev).add(b.id))}
            />
            <BannerInfo banner={b} />
          </button>
        ))}
      </div>
      </div>
      {count > 1 && (
        <div class="banner-dots" role="tablist">
          {banners.map((b, i) => (
            <button
              key={b.id}
              class={i === shownIndex ? "dot active" : "dot"}
              aria-label={`${i + 1}/${count}`}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
