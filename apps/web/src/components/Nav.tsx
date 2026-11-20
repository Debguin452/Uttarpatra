import { t } from "@coaching-app/shared/i18n";
import { IconBatches, IconHome, IconLearning, IconProfile, IconTest } from "@coaching-app/ui/icons";
import { segments } from "../lib/router";

const TABS = [
  { id: "home", label: "nav_home", Icon: IconHome, match: ["home"] },
  { id: "batches", label: "nav_batches", Icon: IconBatches, match: ["batches", "enroll"] },
  { id: "learning", label: "nav_learning", Icon: IconLearning, match: ["learning", "doubt"] },
  { id: "tests", label: "nav_test", Icon: IconTest, match: ["tests"] },
  { id: "profile", label: "nav_profile", Icon: IconProfile, match: ["profile", "teach", "admin"] },
] as const;

export function Nav({ restricted = false }: { restricted?: boolean }) {
  const current = segments()[0] ?? "home";
  const tabs = restricted ? TABS.filter((tab) => tab.id === "profile") : TABS;
  return (
    <nav class="nav" aria-label="Main">
      <div class="nav-inner">
        {tabs.map(({ id, label, Icon, match }) => (
          <a href={`#/${id}`} aria-current={(match as readonly string[]).includes(current) ? "page" : undefined}>
            <Icon size={22} />
            <span>{t(label)}</span>
          </a>
        ))}
      </div>
    </nav>
  );
}
