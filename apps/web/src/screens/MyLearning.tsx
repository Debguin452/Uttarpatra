import { useEffect } from "preact/hooks";
import { t } from "@coaching-app/shared/i18n";
import { BannerImage } from "../components/BannerImage";
import { LearningBatch } from "../components/LearningBatch";
import { Async, Loading } from "../components/ui";
import { pick } from "../lib/format";
import { useBatches, useLearningSummary, useMyBatches } from "../lib/queries";
import { go } from "../lib/router";
import { refreshMe } from "../lib/session";

// The student's own space: the batches they are learning in, with progress.
export function MyLearning() {
  const summary = useLearningSummary();
  useEffect(() => void refreshMe(), []);

  return (
    <div class="screen">
      <div class="row-between">
        <h1 class="title">{t("nav_learning")}</h1>
        <button class="btn small quiet" onClick={() => go("doubt")}>
          {t("nav_doubt")}
        </button>
      </div>
      <Async q={summary}>
        {(rows) =>
          rows.length === 0 ? (
            <div class="panel stack">
              <strong>{t("learn_empty_title")}</strong>
              <p class="muted small">{t("learn_empty_hint")}</p>
              <button class="btn primary block" onClick={() => go("batches")}>
                {t("learn_browse")}
              </button>
            </div>
          ) : (
            <div class="stack">
              {rows.map((row) => {
                const percent = row.total === 0 ? 0 : Math.round((row.done / row.total) * 100);
                return (
                  <button class="learn-card" key={row.batch_id} onClick={() => go(`learning/${row.batch_id}`)}>
                    {row.banner_url && <BannerImage class="batch-banner" src={row.banner_url} />}
                    <span class="name">{pick(row, "title")}</span>
                    <span class="meta">{t("learn_progress_count", { done: row.done, total: row.total })} · {percent}%</span>
                    <span class="progress thin" aria-hidden="true">
                      <span style={{ width: `${percent}%` }} />
                    </span>
                  </button>
                );
              })}
            </div>
          )
        }
      </Async>
    </div>
  );
}

// One batch, opened from My Learning (or from the Continue shortcut on Home).
export function LearningScreen({ batchId, lectureId }: { batchId: string; lectureId?: string }) {
  const catalog = useBatches();
  const mine = useMyBatches();
  const batch = mine.data?.find((b) => b.id === batchId) ?? catalog.data?.find((b) => b.id === batchId);
  useEffect(() => void refreshMe(), [batchId]);

  return (
    <div class="screen">
      <button class="btn small quiet" style="justify-self:start" onClick={() => go("learning")}>
        {t("back")}
      </button>
      {!batch ? (
        catalog.isLoading || mine.isLoading ? <Loading /> : <p class="muted">{t("no_batches")}</p>
      ) : (
        <>
          <h1 class="title">{pick(batch, "title")}</h1>
          <LearningBatch batch={batch} initialLectureId={lectureId ?? null} />
        </>
      )}
    </div>
  );
}
