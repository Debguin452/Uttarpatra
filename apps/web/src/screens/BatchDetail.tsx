import { useEffect } from "preact/hooks";
import { t } from "@coaching-app/shared/i18n";
import { Loading } from "../components/ui";
import { BannerImage } from "../components/BannerImage";
import { LearningBatch } from "../components/LearningBatch";
import { TeacherCards } from "../components/TeacherCards";
import { focusTarget } from "../lib/focus";
import { money, pick } from "../lib/format";
import { useBatches, useMyBatches, usePayments } from "../lib/queries";
import { dateOnly, enrollState } from "../lib/enrollment";
import { go } from "../lib/router";
import { enrolledIds, refreshMe } from "../lib/session";

const embed = (id: string) => `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1`;

export function BatchDetail({ batchId }: { batchId: string }) {
  const catalog = useBatches();
  const mine = useMyBatches();
  const enrolled = enrolledIds().has(batchId);
  const batch = catalog.data?.find((b) => b.id === batchId) ?? mine.data?.find((b) => b.id === batchId);
  const waiting = !batch && (catalog.isLoading || mine.isLoading);
  const payments = usePayments();
  const state = batch ? enrollState(batch, payments.data) : null;

  // A payment may have been approved since sign-in: look again when the page opens.
  useEffect(() => void refreshMe(), [batchId]);

  // A banner's lecture/material focus only applies once the content is open to this student.
  useEffect(() => {
    if (batch && !enrolled && batch.kind !== "free") focusTarget.value = null;
  }, [batch?.id, enrolled]);

  return (
    <div class="screen">
      <button class="btn small quiet" style="justify-self:start" onClick={() => go("batches")}>
        {t("back")}
      </button>
      {waiting ? (
        <Loading />
      ) : !batch ? (
        <p class="muted">{t("no_batches")}</p>
      ) : (
        (() => {
          const open = state?.kind === "enrolled" || state?.kind === "free";
          return (
            <>
              {batch.banner_url && <BannerImage class="batch-banner" src={batch.banner_url} />}
              <header class="stack">
                <p class="eyebrow">{t(`filter_${batch.track}`)}</p>
                <h1 class="title">{pick(batch, "title")}</h1>
                {pick(batch, "summary") && <p class="muted">{pick(batch, "summary")}</p>}
                {state?.kind === "enrolled" && (
                  <p class="row-inline">
                    <span class="badge mark">{t("enrolled")}</span>
                    {state.expiresAt && <span class="muted small">{t("enrolled_until", { date: dateOnly(state.expiresAt) })}</span>}
                  </p>
                )}
              </header>
              <TeacherCards batchId={batch.id} />
              {open ? (
                <LearningBatch batch={batch} />
              ) : (
                <div class="stack">
                  {batch.preview_video_id && (
                    <div class="player">
                      <iframe title="Preview" src={embed(batch.preview_video_id)} allowFullScreen />
                    </div>
                  )}
                  {state?.kind === "pending" ? (
                    <div class="panel stack">
                      <strong>{t("under_review_title")}</strong>
                      <p class="muted small">{t("under_review_hint")}</p>
                    </div>
                  ) : (
                    <div class="panel">
                      {state?.kind === "rejected" && <p class="error-text small">{t("payment_rejected_hint")}</p>}
                      <div class="row-between">
                        <span class="muted">{t("price")}</span>
                        <strong class="subtitle">{money(batch.price_paise)}</strong>
                      </div>
                      <button class="btn primary block" onClick={() => go(`enroll/${batch.id}`)}>
                        {state?.kind === "rejected" ? t("try_again") : t("enroll")}
                      </button>
                      <p class="hint">{t("not_enrolled")}</p>
                    </div>
                  )}
                </div>
              )}
            </>
          );
        })()
      )}
    </div>
  );
}
