import { pick } from "./format";
import type { SubjectRow } from "./types";

export function subjectName(rows: SubjectRow[] | null, id: string): string {
  const row = rows?.find((s) => s.id === id);
  return row ? pick(row, "name") : id;
}

export function subjectNames(rows: SubjectRow[] | null, ids: string[] | null): string {
  return ids && ids.length > 0 ? ids.map((id) => subjectName(rows, id)).join(", ") : "—";
}
