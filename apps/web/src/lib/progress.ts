import { signal } from "@preact/signals";
import { invalidateQuery } from "@coaching-app/shared/cache/useCachedQuery";
import { shouldComplete, type ProgressLike } from "@coaching-app/shared/learning";
import { api } from "./api";
import { learningSummaryKey, progressKey } from "./cacheKeys";
import { uid } from "./session";
import type { LectureProgress } from "./types";

// What this device has saved since the page loaded. It is shown straight away
// (a ring that fills as you watch) and wins over the slightly older copy the
// server sent, so the screen never waits for a round trip.
const local = signal<Record<string, ProgressLike>>({});

export function mergedProgress(server: LectureProgress[] | null | undefined): Map<string, ProgressLike> {
  const map = new Map<string, ProgressLike>((server ?? []).map((row) => [row.lecture_id, row]));
  for (const [id, mine] of Object.entries(local.value)) {
    const theirs = map.get(id);
    map.set(id, { ...mine, completed: Boolean(mine.completed || theirs?.completed) });
  }
  return map;
}

let lastSent = 0;

/** Saves where the student is in a lecture. Throttled unless `force` (pause, end, leaving the page). */
export async function saveProgress(
  lecture: { id: string; batch_id?: string },
  batchId: string,
  positionSec: number,
  durationSec: number | null,
  opts: { force?: boolean; completed?: boolean } = {},
): Promise<void> {
  const position = Math.max(0, Math.floor(positionSec));
  const duration = durationSec && durationSec > 0 ? Math.floor(durationSec) : null;
  const finished = opts.completed === true || shouldComplete(position, duration);

  local.value = {
    ...local.value,
    [lecture.id]: {
      lecture_id: lecture.id,
      position_sec: position,
      duration_sec: duration,
      completed: finished || Boolean(local.value[lecture.id]?.completed),
      updated_at: Math.floor(Date.now() / 1000),
    },
  };

  const now = Date.now();
  if (!opts.force && !finished && now - lastSent < 4000) return;
  lastSent = now;
  try {
    await api(`/api/learning/lectures/${encodeURIComponent(lecture.id)}/progress`, {
      method: "PUT",
      body: { positionSec: position, ...(duration ? { durationSec: duration } : {}), ...(opts.completed ? { completed: true } : {}) },
    });
    if (finished || opts.force) await invalidateQuery(progressKey(uid(), batchId), learningSummaryKey(uid()));
  } catch {
    /* offline or a hiccup: the next save carries the same information */
  }
}
