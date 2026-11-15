// Per-device "resume where you left off" pointer. There is no backend
// video-progress table yet, so this is intentionally a light, best-effort
// convenience stored in localStorage — never trusted for anything beyond
// showing a shortcut on Home.
const KEY = "continue_learning_v1";

export type ContinueEntry = {
  batchId: string;
  batchTitleBn: string;
  batchTitleEn: string;
  lectureId: string;
  titleBn: string;
  titleEn: string;
  chapter: string;
  at: number;
};

export function setContinueLearning(entry: ContinueEntry) {
  try {
    localStorage.setItem(KEY, JSON.stringify(entry));
  } catch {
    // best-effort; ignore storage failures (private mode, quota, etc.)
  }
}

export function getContinueLearning(): ContinueEntry | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ContinueEntry) : null;
  } catch {
    return null;
  }
}
