import { locale } from "@coaching-app/shared/i18n";
import { decideEnrollState, type EnrollState } from "@coaching-app/shared/enrollState";
import { me } from "./session";
import type { Payment } from "./types";

export type { EnrollState };

// How a batch stands for this student. One place decides (and is tested in
// packages/shared), so the list, the batch page and the payment screen
// can never disagree.
export function enrollState(batch: { id: string; kind: string }, payments: Payment[] | null | undefined): EnrollState {
  const profile = me.value;
  return decideEnrollState(batch, profile && profile.registered ? profile.enrollments : [], payments);
}

export function dateOnly(unixSec: number): string {
  return new Date(unixSec * 1000).toLocaleDateString(locale.value === "bn" ? "bn-IN" : "en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
