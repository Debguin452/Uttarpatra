import { t } from "@coaching-app/shared/i18n";
import { IconChevronRight } from "@coaching-app/ui/icons";
import { GettingStarted } from "../components/GettingStarted";
import { Async, SectionHead, SyncNote } from "../components/ui";
import { greeting, pick } from "../lib/format";
import { useBatches, useNotices, useTests } from "../lib/queries";
import { go } from "../lib/router";
import { enrolledIds, me } from "../lib/session";

export function Home() {
  const batches = useBatches();
  const notices = useNotices();
  const tests = useTests();
  const enrolled = enrolledIds();
  const name = me.value && me.value.registered ? me.value.user.name.split(" ")[0] : "";

  return (
    <div class="screen">
      <header class="stack">
        <p class="eyebrow">{greeting()}</p>
        <h1 class="title">{name}</h1>
      </header>

      <GettingStarted testDone={Boolean(tests.data?.some((row) => row.submitted_at))} />

      <section class="stack">
        <SectionHead
          title={t("your_batches")}
          action={
            <button class="btn small quiet" onClick={() => go("batches")}>
              {t("see_all")}
            </button>
          }
        />
        <Async q={batches}>
          {(rows) => {
            const mine = rows.filter((b) => enrolled.has(b.id));
            if (mine.length === 0) return <p class="muted small">{t("no_batches")}</p>;
            return (
              <div class="list">
                {mine.map((b) => (
                  <button class="item" onClick={() => go(`batches/${b.id}`)}>
                    <span class="name">{pick(b, "title")}</span>
                    <span class="side">
                      <IconChevronRight size={18} />
                    </span>
                  </button>
                ))}
              </div>
            );
          }}
        </Async>
      </section>

      <section class="stack">
        <SectionHead
          title={t("test_zone")}
          action={
            <button class="btn small quiet" onClick={() => go("tests")}>
              {t("see_all")}
            </button>
          }
        />
        <Async q={tests}>
          {(rows) => {
            const open = rows.filter((r) => r.status === "live" && !r.submitted_at).slice(0, 3);
            if (open.length === 0) return <p class="muted small">{t("no_tests")}</p>;
            return (
              <div class="list">
                {open.map((r) => (
                  <button class="item" onClick={() => go(`tests/${r.id}`)}>
                    <span class="name">{pick(r, "title")}</span>
                    <span class="meta">
                      {t("duration_min", { minutes: Math.round(r.duration_sec / 60) })} · {t("marks_total", { marks: r.total_marks })}
                    </span>
                    <span class="side">
                      <IconChevronRight size={18} />
                    </span>
                  </button>
                ))}
              </div>
            );
          }}
        </Async>
      </section>

      <section class="stack">
        <SectionHead title={t("notice_board")} />
        <Async q={notices}>
          {(rows) =>
            rows.length === 0 ? (
              <p class="muted small">{t("no_notices")}</p>
            ) : (
              <div class="stack">
                {rows.map((n) => (
                  <article class={n.pinned ? "notice pinned" : "notice"}>
                    <strong>{pick(n, "title")}</strong>
                    {pick(n, "body") && <span class="small muted">{pick(n, "body")}</span>}
                  </article>
                ))}
                <SyncNote syncedAt={notices.syncedAt} isStale={notices.isStale} />
              </div>
            )
          }
        </Async>
      </section>
    </div>
  );
}
