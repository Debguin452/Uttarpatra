import { idbGet, idbSet } from "@coaching-app/shared/cache/idbStore";
import type { TestRow } from "./types";

export const testsKey = (uid: string) => `${uid}:tests`;

export async function markTestSubmitted(uid: string, testId: string, score: number): Promise<void> {
  const cached = await idbGet<TestRow[]>(testsKey(uid));
  if (!cached) return;
  const next = cached.value.map((row) =>
    row.id === testId ? { ...row, score, submitted_at: Math.floor(Date.now() / 1000) } : row,
  );
  await idbSet(testsKey(uid), next, 0);
}
