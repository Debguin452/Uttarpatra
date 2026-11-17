import { useEffect, useRef, useState } from "preact/hooks";
import type { Banner } from "../lib/types";
import { go } from "../lib/router";
import { pick } from "../lib/format";

const AUTO_ADVANCE_MS = 5000;
const SWIPE_THRESHOLD = 0.22; // fraction of track width to commit a swipe

function openBanner(b: Banner) {
  if (b.link_url) {
    if (b.link_url.startsWith("http")) window.open(b.link_url, "_blank", "noopener");
    else go(b.link_url.replace(/^#\/?/, ""));
  } else if (b.batch_id) {
    go(`batches/${b.batch_id}`);
  }
}

export function BannerCarousel({ banners }: { banners: Banner[] }) {
  const [index, setIndex] = useState(0);
  const [dragPx, setDragPx] = useState(0);
  const dragging = useRef(false);
  const startX = useRef(0);
  const moved = useRef(false); // true once a drag has moved past a tap-vs-swipe threshold
  const trackRef = useRef<HTMLDivElement>(null);

  const count = banners.length;
  const clamp = (i: number) => (i + count) % count;

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
      <div
        class="banner-track"
        ref={trackRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          transform: `translateX(calc(${-index * 100}% + ${dragPx}px))`,
          transition: dragging.current ? "none" : undefined,
        }}
      >
        {banners.map((b) => (
          <button class="banner-slide" key={b.id} onClick={() => !moved.current && openBanner(b)}>
            <img src={b.image_url} alt={pick(b, "title")} draggable={false} />
          </button>
        ))}
      </div>
      {count > 1 && (
        <div class="banner-dots" role="tablist">
          {banners.map((b, i) => (
            <button
              key={b.id}
              class={i === index ? "dot active" : "dot"}
              aria-label={`${i + 1}/${count}`}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
