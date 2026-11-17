import { useEffect, useState } from "preact/hooks";
import { t } from "@coaching-app/shared/i18n";
import { Async, Loading, SectionHead } from "../components/ui";
import { TeacherCards } from "../components/TeacherCards";
import { setContinueLearning } from "../lib/continueLearning";
import { money, pick } from "../lib/format";
import { useBatchContent, useBatches, useMyBatches } from "../lib/queries";
import { go } from "../lib/router";
import { markOpenedLecture } from "../lib/onboarding";
import { enrolledIds } from "../lib/session";
import type { Batch, Lecture } from "../lib/types";

const embed = (id: string) => `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1`;
const driveLink = (id: string) => `https://drive.google.com/file/d/${encodeURIComponent(id)}/view`;

function Content({ batch }: { batch: Batch }) {
  const content = useBatchContent(batch.id);
  const [active, setActive] = useState<Lecture | null>(null);

  const lectures = content.data?.lectures ?? [];
  const current = active ?? lectures[0] ?? null;

  useEffect(() => {
    if (content.data && content.data.lectures.length > 0) markOpenedLecture();
  }, [content.data]);

  useEffect(() => {
    if (!current) return;
    setContinueLearning({
      batchId: batch.id,
      batchTitleBn: batch.title_bn,
      batchTitleEn: batch.title_en,
      lectureId: current.id,
      titleBn: current.title_bn,
      titleEn: current.title_en,
      chapter: current.chapter,
      at: Date.now(),
    });
  }, [current?.id]);

  return (
    <Async q={content}>
      {({ lectures, notes }) => {
        const current = active ?? lectures[0] ?? null;
        const chapters = [...new Set(lectures.map((r) => r.chapter))];
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
            {lectures.length === 0 && <p class="muted small">{t("no_lectures")}</p>}
            {chapters.map((chapter) => (
              <div class="stack" key={chapter}>
                <p class="eyebrow">{chapter}</p>
                <div class="list">
                  {lectures
                    .filter((r) => r.chapter === chapter)
                    .map((lecture) => (
                      <button
                        class="item"
                        key={lecture.id}
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

            <SectionHead title={t("study_materials")} />
            {notes.length === 0 ? (
              <p class="muted small">{t("no_materials")}</p>
            ) : (
              <div class="list">
                {notes.map((note) => (
                  <a
                    class="item"
                    key={note.id}
                    href={driveLink(note.drive_file_id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style="text-decoration:none"
                  >
                    <span class="name">{pick(note, "title")}</span>
                    <span class="side">
                      <span class="badge">{note.kind === "dpp" ? t("material_dpp") : t("material_note")}</span>
                    </span>
                  </a>
                ))}
              </div>
            )}
          </div>
        );
      }}
    </Async>
  );
}

export function BatchDetail({ batchId }: { batchId: string }) {
  const catalog = useBatches();
  const mine = useMyBatches();
  const enrolled = enrolledIds().has(batchId);
  const batch = catalog.data?.find((b) => b.id === batchId) ?? mine.data?.find((b) => b.id === batchId);
  const waiting = !batch && (catalog.isLoading || mine.isLoading);

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
          const open = enrolled || batch.kind === "free";
          return (
            <>
              {batch.banner_url && (
                <img
                  class="batch-banner"
                  src={batch.banner_url}
                  alt=""
                  onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
                />
              )}
              <header class="stack">
                <p class="eyebrow">{t(`filter_${batch.track}`)}</p>
                <h1 class="title">{pick(batch, "title")}</h1>
                {pick(batch, "summary") && <p class="muted">{pick(batch, "summary")}</p>}
              </header>
              <TeacherCards batchId={batch.id} />
              {open ? (
                <Content batch={batch} />
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
