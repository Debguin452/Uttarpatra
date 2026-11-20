import { useEffect, useRef, useState } from "preact/hooks";
import { t } from "@coaching-app/shared/i18n";
import {
  continueTarget,
  flatten,
  groupLectures,
  neighbours,
  resumeAt,
  stats,
  type NumberedLecture,
  type SubjectGroup,
} from "@coaching-app/shared/learning";
import { IconCheck, IconLock, IconPlay } from "@coaching-app/ui/icons";
import { setContinueLearning } from "../lib/continueLearning";
import { focusTarget } from "../lib/focus";
import { pick, when } from "../lib/format";
import { markOpenedLecture } from "../lib/onboarding";
import { mergedProgress, saveProgress } from "../lib/progress";
import { useBatchContent, useLectureProgress } from "../lib/queries";
import { go } from "../lib/router";
import type { BatchContent, BatchNote, Lecture } from "../lib/types";
import { YouTubePlayer } from "./YouTubePlayer";
import { Async, SectionHead } from "./ui";

type Batch = { id: string; title_bn: string; title_en: string };
type Numbered = NumberedLecture<Lecture>;

const driveLink = (id: string) => `https://drive.google.com/file/d/${encodeURIComponent(id)}/view`;

function Bar({ percent, thin = false }: { percent: number; thin?: boolean }) {
  return (
    <div class={thin ? "progress thin" : "progress"} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
      <span style={{ width: `${percent}%` }} />
    </div>
  );
}

function Material({ note, highlight }: { note: BatchNote; highlight: string | null }) {
  return (
    <a
      class={note.id === highlight ? "item focused" : "item"}
      id={`note-${note.id}`}
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
  );
}

function LectureView({
  batch,
  lecture,
  groups,
  notes,
  progress,
  onSelect,
  onBack,
}: {
  batch: Batch;
  lecture: Numbered;
  groups: SubjectGroup<Lecture>[];
  notes: BatchNote[];
  progress: ReturnType<typeof mergedProgress>;
  onSelect: (id: string) => void;
  onBack: () => void;
}) {
  const { prev, next } = neighbours(groups, lecture.id);
  const mine = progress.get(lecture.id);
  const done = Boolean(mine?.completed);
  const locked = Boolean(lecture.locked) || !lecture.youtube_id;
  const start = useRef(resumeAt(mine)).current; // fixed for this lecture: resume point, not a moving target

  useEffect(() => {
    setContinueLearning({
      batchId: batch.id,
      batchTitleBn: batch.title_bn,
      batchTitleEn: batch.title_en,
      lectureId: lecture.id,
      titleBn: lecture.title_bn,
      titleEn: lecture.title_en,
      chapter: lecture.chapter,
      at: Date.now(),
    });
    scrollTo({ top: 0 });
  }, [lecture.id]);

  const attached = notes.filter((n) => n.lecture_id === lecture.id);
  return (
    <div class="stack">
      <button class="btn small quiet" style="justify-self:start" onClick={onBack}>
        {t("learn_all_lectures")}
      </button>

      {locked ? (
        <div class="panel stack">
          <strong>{t("learn_locked_title")}</strong>
          <p class="muted small">{lecture.release_at ? t("learn_opens", { date: when(lecture.release_at) }) : t("learn_locked_hint")}</p>
        </div>
      ) : (
        <YouTubePlayer
          key={lecture.id}
          videoId={lecture.youtube_id!}
          title={pick(lecture, "title")}
          startSec={start}
          onEvent={(e) => void saveProgress(lecture, batch.id, e.position, e.duration, { force: e.force, completed: e.ended })}
        />
      )}

      <header class="stack">
        <p class="eyebrow">
          {lecture.chapter} · {t("learn_lecture_no", { n: String(lecture.number).padStart(2, "0") })}
        </p>
        <h2 class="title">{pick(lecture, "title")}</h2>
        {done && (
          <p class="row-inline">
            <IconCheck size={18} /> <span class="badge mark">{t("learn_completed")}</span>
          </p>
        )}
      </header>

      <div class="row-between">
        <button class="btn" disabled={!prev || Boolean(prev.locked)} onClick={() => prev && onSelect(prev.id)}>
          {t("learn_previous")}
        </button>
        <button class="btn primary" disabled={!next || Boolean(next.locked)} onClick={() => next && onSelect(next.id)}>
          {t("learn_next")}
        </button>
      </div>
      {!done && !locked && (
        <button
          class="btn block quiet"
          onClick={() => void saveProgress(lecture, batch.id, mine?.position_sec ?? 0, lecture.duration_sec, { force: true, completed: true })}
        >
          {t("learn_mark_complete")}
        </button>
      )}

      {attached.length > 0 && (
        <>
          <SectionHead title={t("learn_this_lecture")} />
          <div class="list">
            {attached.map((n) => (
              <Material key={n.id} note={n} highlight={null} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Body({ batch, data, initialLectureId }: { batch: Batch; data: BatchContent; initialLectureId: string | null }) {
  const serverProgress = useLectureProgress(batch.id);
  const progress = mergedProgress(serverProgress.data);
  const groups = groupLectures(data.lectures, data.subjects);
  const all = flatten(groups);
  const overall = stats(data.lectures, progress);
  const target = continueTarget(groups, progress);

  const [selectedId, setSelectedId] = useState<string | null>(initialLectureId);
  const [highlight, setHighlight] = useState<string | null>(null);
  const selected = all.find((l) => l.id === selectedId) ?? null;

  useEffect(() => {
    if (data.lectures.length > 0) markOpenedLecture();
  }, [data.lectures.length]);

  // Coming from a banner: open that lecture, or bring that material into view.
  useEffect(() => {
    const focus = focusTarget.value;
    if (!focus) return;
    focusTarget.value = null;
    if (focus.type === "lecture" && all.some((l) => l.id === focus.id)) setSelectedId(focus.id);
    if (focus.type === "material") {
      setHighlight(focus.id);
      setTimeout(() => document.getElementById(`note-${focus.id}`)?.scrollIntoView({ block: "center", behavior: "smooth" }), 150);
      setTimeout(() => setHighlight(null), 3000);
    }
  }, []);

  if (selected) {
    return (
      <LectureView
        key={selected.id}
        batch={batch}
        lecture={selected}
        groups={groups}
        notes={data.notes}
        progress={progress}
        onSelect={setSelectedId}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  const inChapter = new Set(all.map((l) => l.id));
  const looseNotes = data.notes.filter((n) => !n.lecture_id || !inChapter.has(n.lecture_id));
  const subjectName = (id: string | null) => {
    const subject = data.subjects.find((s) => s.id === id);
    return subject ? pick(subject, "name") : t("learn_general");
  };

  return (
    <div class="stack">
      <section class="panel stack">
        <div class="row-between">
          <strong>{t("learn_progress")}</strong>
          <span class="muted small">{t("learn_progress_count", { done: overall.done, total: overall.total })}</span>
        </div>
        <Bar percent={overall.percent} />
        {target && (
          <button class="btn primary block" onClick={() => setSelectedId(target.id)}>
            {overall.done > 0 || progress.get(target.id) ? t("continue_learning") : t("learn_start")}
          </button>
        )}
      </section>

      {groups.length === 0 && <p class="muted small">{t("no_lectures")}</p>}

      {groups.map((group) => (
        <section class="stack" key={group.subjectId ?? "none"}>
          <SectionHead title={subjectName(group.subjectId)} />
          {group.chapters.map((chapter) => {
            const s = stats(chapter.lectures, progress);
            const ids = new Set(chapter.lectures.map((l) => l.id));
            const chapterNotes = data.notes.filter((n) => n.lecture_id && ids.has(n.lecture_id));
            return (
              <div class="stack" key={chapter.chapter}>
                <div class="row-between">
                  <p class="eyebrow">{chapter.chapter}</p>
                  <span class="muted small">
                    {s.done}/{s.total} · {s.percent}%
                  </span>
                </div>
                <Bar percent={s.percent} thin />
                <div class="list">
                  {chapter.lectures.map((lecture) => {
                    const locked = Boolean(lecture.locked);
                    const finished = Boolean(progress.get(lecture.id)?.completed);
                    return (
                      <button class="item" key={lecture.id} disabled={locked} onClick={() => setSelectedId(lecture.id)}>
                        <span class="name">
                          <span class="lecture-no">{String(lecture.number).padStart(2, "0")}</span> {pick(lecture, "title")}
                        </span>
                        <span class="meta">
                          {locked && lecture.release_at
                            ? t("learn_opens", { date: when(lecture.release_at) })
                            : lecture.duration_sec
                              ? t("duration_min", { minutes: Math.round(lecture.duration_sec / 60) })
                              : ""}
                        </span>
                        <span class="side">
                          {lecture.is_live ? <span class="badge live">{t("live")}</span> : null}
                          {finished ? <IconCheck size={20} className="done-icon" /> : locked ? <IconLock size={18} /> : <IconPlay size={20} />}
                        </span>
                      </button>
                    );
                  })}
                  {chapterNotes.map((n) => (
                    <Material key={n.id} note={n} highlight={highlight} />
                  ))}
                </div>
              </div>
            );
          })}
        </section>
      ))}

      <SectionHead title={t("study_materials")} />
      {looseNotes.length === 0 ? (
        <p class="muted small">{t("no_materials")}</p>
      ) : (
        <div class="list">
          {looseNotes.map((n) => (
            <Material key={n.id} note={n} highlight={highlight} />
          ))}
        </div>
      )}

      <button class="item" onClick={() => go("tests")}>
        <span class="name">{t("learn_tests")}</span>
        <span class="meta">{t("learn_tests_hint")}</span>
      </button>
    </div>
  );
}

// Everything a student does inside a batch: the course as subjects, chapters and
// numbered lectures, with progress, resume, previous/next, notes and DPPs.
export function LearningBatch({ batch, initialLectureId = null }: { batch: Batch; initialLectureId?: string | null }) {
  const content = useBatchContent(batch.id);
  return <Async q={content}>{(data) => <Body batch={batch} data={data} initialLectureId={initialLectureId} />}</Async>;
}
