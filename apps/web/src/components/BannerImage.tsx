import { useState } from "preact/hooks";
import { imageSrc } from "../lib/image";

// A 16:9 image frame with a shimmer while the image loads and a soft fade-in
// once it has. If the image cannot be loaded it renders nothing and tells the
// caller, so a dead link never leaves an empty box or a broken-image icon.
export function BannerImage({
  src,
  alt = "",
  class: className = "",
  onFail,
}: {
  src: string;
  alt?: string;
  class?: string;
  onFail?: () => void;
}) {
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  if (state === "failed") return null;

  return (
    <div class={`banner-frame ${className}`} data-state={state}>
      {state === "loading" && <div class="skeleton-block" aria-hidden="true" />}
      <img
        src={imageSrc(src)}
        alt={alt}
        draggable={false}
        decoding="async"
        referrerPolicy="no-referrer"
        onLoad={() => setState("ready")}
        onError={() => {
          setState("failed");
          onFail?.();
        }}
      />
    </div>
  );
}
