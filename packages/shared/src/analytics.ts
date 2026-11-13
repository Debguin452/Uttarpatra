export type AnalyticsRaw = {
  totalStudents: number;
  activeStudents: number;
  blockedStudents: number;
  newSignups7d: number;
  revenueApprovedPaise: number;
  pendingPaymentsCount: number;
  pendingPaymentsAmountPaise: number;
  totalAttempts: number;
  avgScoreRaw: number | null;
  openDoubts: number;
  batchEnrollments: { batchId: string; titleEn: string; count: number }[];
};

export type AnalyticsOverview = {
  students: { total: number; active: number; blocked: number; newLast7Days: number };
  revenue: { approvedRupees: number; pendingCount: number; pendingRupees: number };
  tests: { totalAttempts: number; averageScore: number | null };
  doubts: { open: number };
  batches: { batchId: string; titleEn: string; enrollments: number }[];
};
export function buildAnalyticsOverview(raw: AnalyticsRaw): AnalyticsOverview {
  return {
    students: {
      total: raw.totalStudents,
      active: raw.activeStudents,
      blocked: raw.blockedStudents,
      newLast7Days: raw.newSignups7d,
    },
    revenue: {
      approvedRupees: raw.revenueApprovedPaise / 100,
      pendingCount: raw.pendingPaymentsCount,
      pendingRupees: raw.pendingPaymentsAmountPaise / 100,
    },
    tests: {
      totalAttempts: raw.totalAttempts,
      averageScore: raw.avgScoreRaw === null ? null : Math.round(raw.avgScoreRaw * 100) / 100,
    },
    doubts: { open: raw.openDoubts },
    batches: raw.batchEnrollments.map((b) => ({
      batchId: b.batchId,
      titleEn: b.titleEn,
      enrollments: b.count,
    })),
  };
}
