import { describe, it, expect } from "vitest";
import { buildAnalyticsOverview, type AnalyticsRaw } from "./analytics";

const raw: AnalyticsRaw = {
  totalStudents: 120,
  activeStudents: 115,
  blockedStudents: 5,
  newSignups7d: 8,
  revenueApprovedPaise: 1_234_550,
  pendingPaymentsCount: 3,
  pendingPaymentsAmountPaise: 15_000,
  totalAttempts: 340,
  avgScoreRaw: 67.891,
  openDoubts: 4,
  batchEnrollments: [
    { batchId: "neet-2027", titleEn: "NEET 2027", count: 80 },
    { batchId: "jee-2027", titleEn: "JEE 2027", count: 40 },
  ],
};

describe("buildAnalyticsOverview", () => {
  it("maps student counts through unchanged", () => {
    const result = buildAnalyticsOverview(raw);
    expect(result.students).toEqual({ total: 120, active: 115, blocked: 5, newLast7Days: 8 });
  });

  it("converts revenue from paise to rupees", () => {
    const result = buildAnalyticsOverview(raw);
    expect(result.revenue.approvedRupees).toBeCloseTo(12345.5);
    expect(result.revenue.pendingRupees).toBeCloseTo(150);
    expect(result.revenue.pendingCount).toBe(3);
  });

  it("rounds the average score to 2 decimal places", () => {
    const result = buildAnalyticsOverview(raw);
    expect(result.tests.averageScore).toBe(67.89);
  });

  it("reports null average score when there are no attempts, instead of 0", () => {
    const result = buildAnalyticsOverview({ ...raw, totalAttempts: 0, avgScoreRaw: null });
    expect(result.tests.averageScore).toBeNull();
    expect(result.tests.totalAttempts).toBe(0);
  });

  it("maps open doubts through", () => {
    expect(buildAnalyticsOverview(raw).doubts.open).toBe(4);
  });

  it("maps per-batch enrollment breakdown", () => {
    const result = buildAnalyticsOverview(raw);
    expect(result.batches).toEqual([
      { batchId: "neet-2027", titleEn: "NEET 2027", enrollments: 80 },
      { batchId: "jee-2027", titleEn: "JEE 2027", enrollments: 40 },
    ]);
  });

  it("handles zero revenue and no batches without dividing by zero or throwing", () => {
    const result = buildAnalyticsOverview({
      ...raw,
      revenueApprovedPaise: 0,
      pendingPaymentsAmountPaise: 0,
      batchEnrollments: [],
    });
    expect(result.revenue.approvedRupees).toBe(0);
    expect(result.batches).toEqual([]);
  });
});
