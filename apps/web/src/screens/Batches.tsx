import { useState } from "preact/hooks";
import { t } from "@coaching-app/shared/i18n";
import { IconChevronRight } from "@coaching-app/ui/icons";
import { Async, SyncNote } from "../components/ui";
import { money, pick } from "../lib/format";
import { useBatches } from "../lib/queries";
import { go } from "../lib/router";
import { enrolledIds, me } from "../lib/session";
import type { Batch } from "../lib/types";

const FILTERS = ["all", "class11", "class12", "neet", "jee", "free"] as const;
type Filter = (typeof FILTERS)[number];

const matches = (batch: Batch, filter: Filter) =>
  filter === "all" || (filter === "free" ? batch.kind === "free" : batch.track === filter);

const CLASS_FILTER: Record<string, Filter> = { "11": "class11", "12": "class12", dropper: "neet" };

function defaultFilter(): Filter {
  const profile = me.value && me.value.registered ? me.value.user : null;
  return CLASS_FILTER[profile?.student_class ?? ""] ?? "all";
}

export function Batches() {
  const [filter, setFilter] = useState<Filter>(defaultFilter);
  const batches = useBatches();
  const enrolled = enrolledIds();

  return (
    <div class="screen">
      <h1 class="title">{t("batches_title")}</h1>
      <div class="chips" role="group">
        {FILTERS.map((f) => (
          <button class="chip" aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {t(`filter_${f}`)}
          </button>
        ))}
      </div>
      <Async q={batches}>
        {(rows) => {
          const visible = rows.filter((b) => matches(b, filter));
          if (visible.length === 0) return <p class="muted small">{t("no_batches")}</p>;
          return (
            <div class="stack">
              <div class="list">
                {visible.map((b) => (
                  <button class="item" onClick={() => go(`batches/${b.id}`)}>
                    <span class="name">{pick(b, "title")}</span>
                    <span class="meta">
                      {t(`filter_${b.track}`)} · {b.kind === "free" ? t("free") : money(b.price_paise)}
                    </span>
                    <span class="side">
                      {enrolled.has(b.id) ? <span class="badge mark">{t("enrolled")}</span> : null}
                      <IconChevronRight size={18} />
                    </span>
                  </button>
                ))}
              </div>
              <SyncNote syncedAt={batches.syncedAt} isStale={batches.isStale} />
            </div>
          );
        }}
      </Async>
    </div>
  );
}
