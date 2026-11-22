import { t } from "@coaching-app/shared/i18n";
import { useCommunityBanners } from "../lib/queries";
import { pick } from "../lib/format";
import { BannerImage } from "./BannerImage";

// Only links that are https or a phone call are ever turned into a clickable link.
const safe = (url: string) => /^https:\/\/\S+$/.test(url) || /^tel:\+?[0-9]{6,15}$/.test(url);

// Support, guidelines, helpline, group links and urgent notices, at the top of the Doubt tab.
export function CommunityBanners() {
  const banners = useCommunityBanners().data ?? [];
  if (banners.length === 0) return null;

  return (
    <div class="stack">
      {banners.map((b) => {
        const hours = pick(b, "support_hours");
        const description = pick(b, "description");
        return (
          <section class="panel stack community-banner" key={b.id}>
            {b.image_url && <BannerImage class="batch-banner" src={b.image_url} />}
            <strong>{pick(b, "title")}</strong>
            {description && <p class="small" style="white-space:pre-wrap">{description}</p>}
            {hours && (
              <p class="small muted">
                {t("support_hours")}: {hours}
              </p>
            )}
            {(b.phone || b.buttons.length > 0) && (
              <div class="row-inline">
                {b.phone && (
                  <a class="btn small primary" href={`tel:${b.phone.replace(/[^0-9+]/g, "")}`}>
                    {t("support_call", { phone: b.phone })}
                  </a>
                )}
                {b.buttons
                  .filter((button) => safe(button.url))
                  .map((button) => (
                    <a class="btn small" key={button.url} href={button.url} target="_blank" rel="noopener noreferrer">
                      {pick(button, "label")}
                    </a>
                  ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
