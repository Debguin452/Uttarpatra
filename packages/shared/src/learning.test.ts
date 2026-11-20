import { describe, expect, it } from "vitest";
import { continueTarget, flatten, groupLectures, neighbours, resumeAt, shouldComplete, stats, type ProgressLike } from "./learning";

const lec = (id: string, subject: string | null, chapter: string, order: number, locked = false) => ({
  id,
  subject_id: subject,
  chapter,
  order_index: order,
  locked,
});
const prog = (rows: ProgressLike[]) => new Map(rows.map((r) => [r.lecture_id, r]));

const lectures = [
  lec("c2", "chem", "Acids", 5),
  lec("p1", "phy", "Electrostatics", 1),
  lec("p2", "phy", "Electrostatics", 2),
  lec("p3", "phy", "Electrostatics", 3),
  lec("p4", "phy", "Electrostatics", 4, true),
  lec("g1", null, "Welcome", 0),
  lec("p5", "phy", "Current", 6),
];
const subjects = [
  { id: "phy", sort_order: 1 },
  { id: "chem", sort_order: 2 },
];

describe("groupLectures", () => {
  const groups = groupLectures(lectures, subjects);

  it("orders subjects by their sort order, with no-subject lectures last", () => {
    expect(groups.map((g) => g.subjectId)).toEqual(["phy", "chem", null]);
  });

  it("keeps chapters in the order they start and numbers lectures from 1 inside each chapter", () => {
    const phy = groups[0]!;
    expect(phy.chapters.map((c) => c.chapter)).toEqual(["Electrostatics", "Current"]);
    expect(phy.chapters[0]!.lectures.map((l) => [l.id, l.number])).toEqual([["p1", 1], ["p2", 2], ["p3", 3], ["p4", 4]]);
    expect(phy.chapters[1]!.lectures[0]!.number).toBe(1);
  });

  it("does not drop or duplicate lectures", () => {
    expect(flatten(groups).map((l) => l.id).sort()).toEqual(lectures.map((l) => l.id).sort());
  });

  it("an unknown subject id sorts after known ones but before no-subject", () => {
    const g = groupLectures([lec("x", "ghost", "A", 1), lec("y", null, "B", 2), lec("z", "phy", "C", 3)], subjects);
    expect(g.map((s) => s.subjectId)).toEqual(["phy", "ghost", null]);
  });
});

describe("neighbours", () => {
  const groups = groupLectures(lectures, subjects);
  it("finds the previous and next lecture, including across chapters", () => {
    expect(neighbours(groups, "p2")).toMatchObject({ prev: { id: "p1" }, next: { id: "p3" } });
    expect(neighbours(groups, "p4").next?.id).toBe("p5");
  });
  it("has no previous at the start and no next at the end", () => {
    expect(neighbours(groups, "p1").prev).toBeNull();
    expect(neighbours(groups, "g1").next).toBeNull();
  });
});

describe("stats", () => {
  it("counts completed over open lectures, ignoring scheduled ones", () => {
    const phyChapter = lectures.filter((l) => l.chapter === "Electrostatics");
    const s = stats(phyChapter, prog([{ lecture_id: "p1", position_sec: 0, completed: 1 }, { lecture_id: "p2", position_sec: 9, completed: 0 }]));
    expect(s).toEqual({ done: 1, total: 3, percent: 33 });
  });
  it("is 0% for an empty chapter, not NaN", () => {
    expect(stats([], new Map())).toEqual({ done: 0, total: 0, percent: 0 });
  });
});

describe("completion and resume", () => {
  it("completes at 90% of the lecture", () => {
    expect(shouldComplete(899, 1000)).toBe(false);
    expect(shouldComplete(900, 1000)).toBe(true);
    expect(shouldComplete(500, null)).toBe(false);
  });
  it("resumes a couple of seconds before where they stopped", () => {
    expect(resumeAt({ lecture_id: "a", position_sec: 120, duration_sec: 1000, completed: 0 })).toBe(118);
  });
  it("starts from the top when new, barely started, finished or almost over", () => {
    expect(resumeAt(undefined)).toBe(0);
    expect(resumeAt({ lecture_id: "a", position_sec: 3, completed: 0 })).toBe(0);
    expect(resumeAt({ lecture_id: "a", position_sec: 400, completed: 1 })).toBe(0);
    expect(resumeAt({ lecture_id: "a", position_sec: 970, duration_sec: 1000, completed: 0 })).toBe(0);
  });
});

describe("continueTarget", () => {
  const groups = groupLectures(lectures, subjects);
  it("prefers the lecture most recently watched part-way", () => {
    const t = continueTarget(groups, prog([
      { lecture_id: "p1", position_sec: 0, completed: 1, updated_at: 10 },
      { lecture_id: "p3", position_sec: 60, completed: 0, updated_at: 50 },
      { lecture_id: "c2", position_sec: 30, completed: 0, updated_at: 20 },
    ]));
    expect(t?.id).toBe("p3");
  });
  it("otherwise opens the first lecture not finished, skipping scheduled ones", () => {
    const t = continueTarget(groups, prog([
      { lecture_id: "p1", position_sec: 0, completed: 1 },
      { lecture_id: "p2", position_sec: 0, completed: 1 },
      { lecture_id: "p3", position_sec: 0, completed: 1 },
    ]));
    expect(t?.id).toBe("p5");
  });
  it("is null when everything open is finished", () => {
    const all = flatten(groups).filter((l) => !l.locked).map((l) => ({ lecture_id: l.id, position_sec: 0, completed: 1 }));
    expect(continueTarget(groups, prog(all))).toBeNull();
  });
});
