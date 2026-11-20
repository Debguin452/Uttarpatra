export type EnrollState =
  | { kind: "enrolled"; expiresAt: number | null }
  | { kind: "free" }
  | { kind: "pending" }
  | { kind: "rejected" }
  | { kind: "available" };

type PaymentLike = { batch_id: string; status: string; created_at: number };

// How a batch stands for one student:
//   enrolled   has access (until expiresAt, or for good when null)
//   free       open to everyone
//   pending    a payment is waiting for approval: do not ask for another
//   rejected   the latest payment was not accepted: paying again is fine
//   available  not enrolled, nothing submitted yet
export function decideEnrollState(
  batch: { id: string; kind: string },
  enrollments: { batch_id: string; expires_at: number | null }[],
  payments: PaymentLike[] | null | undefined,
  nowSec = Math.floor(Date.now() / 1000),
): EnrollState {
  const own = enrollments.find((e) => e.batch_id === batch.id && (e.expires_at === null || e.expires_at > nowSec));
  if (own) return { kind: "enrolled", expiresAt: own.expires_at };
  if (batch.kind === "free") return { kind: "free" };

  const mine = (payments ?? []).filter((p) => p.batch_id === batch.id).sort((a, b) => b.created_at - a.created_at);
  if (mine.some((p) => p.status === "pending")) return { kind: "pending" };
  if (mine[0]?.status === "rejected") return { kind: "rejected" };
  return { kind: "available" };
}
