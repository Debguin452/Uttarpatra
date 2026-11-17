import { useState } from "preact/hooks";
import { t } from "@coaching-app/shared/i18n";
import { IconChevronRight } from "@coaching-app/ui/icons";
import { Async, SyncNote } from "../components/ui";
import { money, pick } from "../lib/format";
import { useBatches } from "../lib/queries";
import { go } from "../lib/router";
import { enrolledIds, me } from "../lib/session";
import type { Batch } from "../lib/types";

const GRADES = ["class5", "class6", "class7", "class8", "class9", "class10", "class11", "class12"] as const;
const FILTERS = ["all", ...GRADES, "neet", "jee", "cuet", "free"] as const;
type Filter = (typeof FILTERS)[number];

const matches = (batch: Batch, filter: Filter) =>
  filter === "all" || (filter === "free" ? batch.kind === "free" : batch.track === filter);

const CLASS_FILTER: Record<string, Filter> = {
  "5": "class5",
  "6": "class6",
  "7": "class7",
  "8": "class8",
  "9": "class9",
  "10": "class10",
  "11": "class11",
  "12": "class12",
  dropper: "neet",
};

function defaultFilter(): Filter {
  const profile = me.value && me.value.registered ? me.value.user : null;
  return CLASS_FILTER[profile?.student_class ?? ""] ?? "all";
}

export function Batches() {
  const [filter, setFilter] = useState<Filter>(defaultFilter);
  const batches = useBatches();
  const enrolled = enrolledIds();
  const own = defaultFilter();
  const ordered = own === "all" ? FILTERS : (["all", own, ...FILTERS.filter((f) => f !== "all" && f !== own)] as readonly Filter[]);

  return (
    <div class="screen">
      <h1 class="title">{t("batches_title")}</h1>
      <div class="chips" role="group">
        {ordered.map((f) => (
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
                  <div class="batch-row" key={b.id}>
                    {b.banner_url && (
                      <img
                        class="batch-banner"
                        src={b.banner_url}
                        alt=""
                        loading="lazy"
                        onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
                      />
                    )}
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
                  </div>
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
