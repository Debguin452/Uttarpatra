import { useEffect, useState } from "preact/hooks";
import { t } from "@coaching-app/shared/i18n";
import { Async, Loading, SectionHead } from "../components/ui";
import { money, pick } from "../lib/format";
import { useBatches, useLectures } from "../lib/queries";
import { go } from "../lib/router";
import { markOpenedLecture } from "../lib/onboarding";
import { enrolledIds } from "../lib/session";
import type { Lecture } from "../lib/types";

const embed = (id: string) => `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1`;

function Lectures({ batchId }: { batchId: string }) {
  const lectures = useLectures(batchId);
  const [active, setActive] = useState<Lecture | null>(null);

  useEffect(() => {
    if (lectures.data && lectures.data.length > 0) markOpenedLecture();
  }, [lectures.data]);

  return (
    <Async q={lectures}>
      {(rows) => {
        const current = active ?? rows[0] ?? null;
        const chapters = [...new Set(rows.map((r) => r.chapter))];
        return (
          <div class="stack">
            {current && (
              <div class="player">
                <iframe
                  title={pick(current, "title")}
                  src={embed(current.youtube_id)}
                  allow="accelerometer; encrypted-media; picture-in-picture"
                  allowFullScreen
                />
              </div>
            )}
            <SectionHead title={t("lectures")} />
            {chapters.map((chapter) => (
              <div class="stack">
                <p class="eyebrow">{chapter}</p>
                <div class="list">
                  {rows
                    .filter((r) => r.chapter === chapter)
                    .map((lecture) => (
                      <button
                        class="item"
                        aria-current={current?.id === lecture.id ? "true" : undefined}
                        onClick={() => {
                          setActive(lecture);
                          scrollTo({ top: 0, behavior: "smooth" });
                        }}
                      >
                        <span class="name">{pick(lecture, "title")}</span>
                        <span class="meta">
                          {lecture.duration_sec ? t("duration_min", { minutes: Math.round(lecture.duration_sec / 60) }) : ""}
                        </span>
                        <span class="side">{lecture.is_live ? <span class="badge live">{t("live")}</span> : null}</span>
                      </button>
                    ))}
                </div>
              </div>
            ))}
          </div>
        );
      }}
    </Async>
  );
}

export function BatchDetail({ batchId }: { batchId: string }) {
  const batches = useBatches();
  const enrolled = enrolledIds().has(batchId);

  return (
    <div class="screen">
      <button class="btn small quiet" style="justify-self:start" onClick={() => go("batches")}>
        {t("back")}
      </button>
      {!batches.data ? (
        <Loading />
      ) : (
        (() => {
          const batch = batches.data.find((b) => b.id === batchId);
          if (!batch) return <p class="muted">{t("no_batches")}</p>;
          const open = enrolled || batch.kind === "free";
          return (
            <>
              <header class="stack">
                <p class="eyebrow">{t(`filter_${batch.track}`)}</p>
                <h1 class="title">{pick(batch, "title")}</h1>
                {pick(batch, "summary") && <p class="muted">{pick(batch, "summary")}</p>}
              </header>
              {open ? (
                <Lectures batchId={batch.id} />
              ) : (
                <div class="stack">
                  {batch.preview_video_id && (
                    <div class="player">
                      <iframe title="Preview" src={embed(batch.preview_video_id)} allowFullScreen />
                    </div>
                  )}
                  <div class="panel">
                    <div class="row-between">
                      <span class="muted">{t("price")}</span>
                      <strong class="subtitle">{money(batch.price_paise)}</strong>
                    </div>
                    <button class="btn primary block" onClick={() => go(`enroll/${batch.id}`)}>
                      {t("enroll")}
                    </button>
                    <p class="hint">{t("not_enrolled")}</p>
                  </div>
                </div>
              )}
            </>
          );
        })()
      )}
    </div>
  );
}
