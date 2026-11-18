import { useEffect, useState } from "preact/hooks";
import { t } from "@coaching-app/shared/i18n";
import { imageSrc } from "../lib/image";

// Live preview under an image-link field. Says plainly when the link does not
// open as an image, which is the usual reason a banner "does not load".
export function AdminImagePreview({ url }: { url: string }) {
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  useEffect(() => setState("loading"), [url]);
  if (!url.trim()) return null;

  return (
    <div class="stack">
      {state !== "failed" && (
        <div class="banner-frame" data-state={state} style="border:1px solid var(--line)">
          <img
            src={imageSrc(url)}
            alt=""
            referrerPolicy="no-referrer"
            onLoad={() => setState("ready")}
            onError={() => setState("failed")}
          />
        </div>
      )}
      {state === "failed" && <p class="error-text small">{t("admin_image_failed")}</p>}
    </div>
  );
}
