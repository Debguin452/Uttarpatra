import { describe, expect, it } from "vitest";
import { decideEnrollState } from "./enrollState";

const paid = { id: "b1", kind: "paid" };
const NOW = 1_800_000_000;
const pay = (status: string, created_at: number, batch_id = "b1") => ({ batch_id, status, created_at });

describe("decideEnrollState", () => {
  it("enrolled wins over everything, including a pending payment", () => {
    const s = decideEnrollState(paid, [{ batch_id: "b1", expires_at: null }], [pay("pending", 5)], NOW);
    expect(s).toEqual({ kind: "enrolled", expiresAt: null });
  });

  it("an expired enrolment no longer counts", () => {
    const s = decideEnrollState(paid, [{ batch_id: "b1", expires_at: NOW - 10 }], [], NOW);
    expect(s.kind).toBe("available");
  });

  it("keeps the expiry date so the app can show it", () => {
    const s = decideEnrollState(paid, [{ batch_id: "b1", expires_at: NOW + 1000 }], [], NOW);
    expect(s).toEqual({ kind: "enrolled", expiresAt: NOW + 1000 });
  });

  it("free batches are open without enrolling", () => {
    expect(decideEnrollState({ id: "f", kind: "free" }, [], [], NOW).kind).toBe("free");
  });

  it("a waiting payment means do not pay again", () => {
    expect(decideEnrollState(paid, [], [pay("pending", 5)], NOW).kind).toBe("pending");
  });

  it("a rejected latest payment allows trying again, but only until a newer one is waiting", () => {
    expect(decideEnrollState(paid, [], [pay("rejected", 5)], NOW).kind).toBe("rejected");
    expect(decideEnrollState(paid, [], [pay("rejected", 5), pay("pending", 9)], NOW).kind).toBe("pending");
    expect(decideEnrollState(paid, [], [pay("approved", 1), pay("rejected", 5)], NOW).kind).toBe("rejected");
  });

  it("ignores payments for other batches, and missing payment data", () => {
    expect(decideEnrollState(paid, [], [pay("pending", 5, "other")], NOW).kind).toBe("available");
    expect(decideEnrollState(paid, [], null, NOW).kind).toBe("available");
    expect(decideEnrollState(paid, [], undefined, NOW).kind).toBe("available");
  });
});
