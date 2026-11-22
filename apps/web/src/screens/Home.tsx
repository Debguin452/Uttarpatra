import { useState } from "preact/hooks";
import { t } from "@coaching-app/shared/i18n";
import { IconChevronRight, IconTray } from "@coaching-app/ui/icons";
import { BannerCarousel } from "../components/BannerCarousel";
import { GettingStarted } from "../components/GettingStarted";
import { Logo } from "../components/Logo";
import { NotificationBell } from "../components/NotificationBell";
import { Async, EmptyState, SectionHead, SyncNote } from "../components/ui";
import { getContinueLearning } from "../lib/continueLearning";
import { greeting, pick, when } from "../lib/format";
import { useBanners, useLiveToday, useMyBatches, useNotices, useTests } from "../lib/queries";
import { go } from "../lib/router";
import { me } from "../lib/session";

function SearchResults({ query, batches, tests, notices }: { query: string; batches: ReturnType<typeof useMyBatches>; tests: ReturnType<typeof useTests>; notices: ReturnType<typeof useNotices> }) {
  const needle = query.trim().toLowerCase();
  const matches = (title: string) => title.toLowerCase().includes(needle);

  const batchHits = (batches.data ?? []).filter((b) => matches(pick(b, "title")));
  const testHits = (tests.data ?? []).filter((r) => matches(pick(r, "title")));
  const noticeHits = (notices.data ?? []).filter((n) => matches(pick(n, "title")));
  const total = batchHits.length + testHits.length + noticeHits.length;

  if (total === 0) return <p class="muted small">{t("search_none")}</p>;

  return (
    <div class="stack">
      {batchHits.length > 0 && (
        <div class="stack">
          <p class="eyebrow">{t("your_batches")}</p>
          <div class="list">
            {batchHits.map((b) => (
              <button class="item" key={b.id} onClick={() => go(`batches/${b.id}`)}>
                <span class="name">{pick(b, "title")}</span>
                <span class="side">
                  <IconChevronRight size={18} />
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
      {testHits.length > 0 && (
        <div class="stack">
          <p class="eyebrow">{t("test_zone")}</p>
          <div class="list">
            {testHits.map((r) => (
              <button class="item" key={r.id} onClick={() => go(`tests/${r.id}`)}>
                <span class="name">{pick(r, "title")}</span>
                <span class="side">
                  <IconChevronRight size={18} />
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
      {noticeHits.length > 0 && (
        <div class="stack">
          <p class="eyebrow">{t("notice_board")}</p>
          <div class="stack">
            {noticeHits.map((n) => (
              <article class="notice" key={n.id}>
                <strong>{pick(n, "title")}</strong>
              </article>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function Home() {
  const batches = useMyBatches();
  const notices = useNotices();
  const tests = useTests();
  const live = useLiveToday();
  const banners = useBanners();
  const [query, setQuery] = useState("");
  const name = me.value && me.value.registered ? me.value.user.name.split(" ")[0] : "";
  const continuing = getContinueLearning();

  return (
    <div class="screen">
      <header class="row-between">
        <div class="stack">
          <p class="eyebrow">{greeting()}</p>
          <h1 class="title">{name}</h1>
        </div>
        <span class="row-inline">
          <NotificationBell />
          <Logo width={56} start />
        </span>
      </header>

      <div class="field">
        <input
          class="input"
          type="search"
          value={query}
          onInput={(e) => setQuery(e.currentTarget.value)}
          placeholder={t("search_placeholder")}
          aria-label={t("search_placeholder")}
        />
      </div>

      {query.trim() ? (
        <SearchResults query={query} batches={batches} tests={tests} notices={notices} />
      ) : (
        <>
          {banners.isLoading && !banners.data ? (
            <div class="skeleton-block banner-skeleton" aria-hidden="true" />
          ) : (
            (banners.data?.length ?? 0) > 0 && <BannerCarousel banners={banners.data!} />
          )}

          {continuing && (
            <section class="stack">
              <SectionHead title={t("continue_learning")} />
              <button class="item" onClick={() => go(`learning/${continuing.batchId}/${continuing.lectureId}`)}>
                <span class="name">{pick({ title_bn: continuing.titleBn, title_en: continuing.titleEn }, "title")}</span>
                <span class="meta">
                  {continuing.chapter} · {pick({ title_bn: continuing.batchTitleBn, title_en: continuing.batchTitleEn }, "title")}
                </span>
                <span class="side">
                  <IconChevronRight size={18} />
                </span>
              </button>
            </section>
          )}

          <Async q={live}>
            {(rows) =>
              rows.length > 0 ? (
                <section class="stack">
                  <SectionHead title={t("live_today")} />
                  <div class="list">
                    {rows.map((lecture) => (
                      <button class="item" key={lecture.id} onClick={() => go(`batches/${lecture.batch_id}`)}>
                        <span class="name">{pick(lecture, "title")}</span>
                        <span class="meta">
                          {pick({ title_bn: lecture.batch_title_bn, title_en: lecture.batch_title_en }, "title")} · {when(lecture.live_at)}
                        </span>
                        <span class="side">
                          <span class="badge live">{t("live")}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              ) : null
            }
          </Async>

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
                const mine = rows;
                if (mine.length === 0) return <EmptyState icon={<IconTray size={36} />} text={t("no_batches")} />;
                return (
                  <div class="list">
                    {mine.map((b) => (
                      <button class="item" onClick={() => go(`batches/${b.id}`)}>
                        <span class="name">{pick(b, "title")}</span>
                        <span class="side">
                          {b.status === "archived" && <span class="badge">{t("batch_archived")}</span>}
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
        </>
      )}
    </div>
  );
}
