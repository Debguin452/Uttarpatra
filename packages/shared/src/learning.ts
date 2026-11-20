// The learning journey, as pure functions: lectures grouped Subject -> Chapter
// -> Lecture, how far along a student is, and where to resume. The server and
// the app both use this, so they can never disagree about "completed".

export type LectureLike = {
  id: string;
  subject_id: string | null;
  chapter: string;
  order_index: number;
  locked?: number | boolean | null;
};
export type SubjectLike = { id: string; sort_order: number };
export type ProgressLike = {
  lecture_id: string;
  position_sec: number;
  duration_sec?: number | null;
  completed: number | boolean;
  updated_at?: number;
};

export type NumberedLecture<L> = L & { number: number };
export type ChapterGroup<L> = { chapter: string; lectures: NumberedLecture<L>[] };
export type SubjectGroup<L> = { subjectId: string | null; chapters: ChapterGroup<L>[] };

/**
 * Subjects in their configured order (lectures with no subject last), chapters
 * in the order they first appear in the course, lectures numbered 1..n inside
 * each chapter.
 */
export function groupLectures<L extends LectureLike>(lectures: L[], subjects: SubjectLike[] = []): SubjectGroup<L>[] {
  const sorted = lectures
    .map((lecture, index) => ({ lecture, index }))
    .sort((a, b) => a.lecture.order_index - b.lecture.order_index || a.index - b.index)
    .map((entry) => entry.lecture);

  const subjectRank = new Map(subjects.map((s, i) => [s.id, s.sort_order * 1000 + i]));
  const rank = (id: string | null) => (id === null ? Number.MAX_SAFE_INTEGER : (subjectRank.get(id) ?? Number.MAX_SAFE_INTEGER - 1));

  const bySubject = new Map<string | null, Map<string, L[]>>();
  for (const lecture of sorted) {
    const subject = lecture.subject_id ?? null;
    const chapters = bySubject.get(subject) ?? new Map<string, L[]>();
    const list = chapters.get(lecture.chapter) ?? [];
    list.push(lecture);
    chapters.set(lecture.chapter, list);
    bySubject.set(subject, chapters);
  }

  return [...bySubject.entries()]
    .sort(([a], [b]) => rank(a) - rank(b))
    .map(([subjectId, chapters]) => ({
      subjectId,
      chapters: [...chapters.entries()].map(([chapter, list]) => ({
        chapter,
        lectures: list.map((lecture, i) => ({ ...lecture, number: i + 1 })),
      })),
    }));
}

export function flatten<L extends LectureLike>(groups: SubjectGroup<L>[]): NumberedLecture<L>[] {
  return groups.flatMap((g) => g.chapters.flatMap((c) => c.lectures));
}

/** Previous and next lecture across the whole course (locked ones included, so the app can show them as locked). */
export function neighbours<L extends LectureLike>(groups: SubjectGroup<L>[], id: string) {
  const all = flatten(groups);
  const at = all.findIndex((l) => l.id === id);
  return { prev: at > 0 ? all[at - 1]! : null, next: at >= 0 && at < all.length - 1 ? all[at + 1]! : null };
}

const isLocked = (l: { locked?: number | boolean | null }) => Boolean(l.locked);
const isDone = (p: ProgressLike | undefined) => Boolean(p?.completed);

/** Completed / total over the lectures that are open now. Scheduled ones do not count against the student yet. */
export function stats(lectures: LectureLike[], progress: Map<string, ProgressLike>) {
  const open = lectures.filter((l) => !isLocked(l));
  const done = open.filter((l) => isDone(progress.get(l.id))).length;
  return { done, total: open.length, percent: open.length === 0 ? 0 : Math.round((done / open.length) * 100) };
}

/** A lecture counts as watched at 90% of its length. */
export function shouldComplete(positionSec: number, durationSec: number | null | undefined): boolean {
  return Boolean(durationSec) && positionSec >= durationSec! * 0.9;
}

/** Where to start playing: where they left off, a couple of seconds back; from the top if finished or nearly so. */
export function resumeAt(p: ProgressLike | undefined): number {
  if (!p || isDone(p) || p.position_sec <= 5) return 0;
  if (p.duration_sec && p.position_sec >= p.duration_sec * 0.95) return 0;
  return Math.max(0, p.position_sec - 2);
}

/** What the "Continue" button opens: the lecture last watched part-way, else the first one not yet finished. */
export function continueTarget<L extends LectureLike>(groups: SubjectGroup<L>[], progress: Map<string, ProgressLike>): NumberedLecture<L> | null {
  const all = flatten(groups).filter((l) => !isLocked(l));
  const partial = all
    .map((l) => ({ l, p: progress.get(l.id) }))
    .filter(({ p }) => p && !isDone(p) && p.position_sec > 5)
    .sort((a, b) => (b.p!.updated_at ?? 0) - (a.p!.updated_at ?? 0))[0];
  if (partial) return partial.l;
  return all.find((l) => !isDone(progress.get(l.id))) ?? null;
}
