import { useCachedQuery } from "@coaching-app/shared/cache/useCachedQuery";
import { api } from "./api";
import { uid } from "./session";
import { testsKey } from "./testCache";
import type { Banner, Batch, BatchContent, BatchTeacher, LeaderboardRow, LiveLecture, MyBatch, Notice, Payment, SubjectRow, TestResult, TestRow } from "./types";

export const useBatches = () =>
  useCachedQuery<Batch[]>("public:batches", () => api<Batch[]>("/public/batches", { auth: false }));

export const useBanners = () =>
  useCachedQuery<Banner[]>("public:banners", () => api<Banner[]>("/public/banners", { auth: false }));

export const myBatchesKey = (forUid: string) => `${forUid}:my-batches`;

export const useMyBatches = () =>
  useCachedQuery<MyBatch[]>(myBatchesKey(uid()), () => api<MyBatch[]>("/api/batches/mine"), { ttlMs: 60_000 });

export const useNotices = () => useCachedQuery<Notice[]>(`${uid()}:notices`, () => api<Notice[]>("/api/notices"));

export const useLiveToday = () =>
  useCachedQuery<LiveLecture[]>(`${uid()}:live-today`, () => api<LiveLecture[]>("/api/batches/live-today"), { ttlMs: 60_000 });

export const useTests = () =>
  useCachedQuery<TestRow[]>(testsKey(uid()), () => api<TestRow[]>("/api/tests"), { ttlMs: 0 });

export const useBatchContent = (batchId: string) =>
  useCachedQuery<BatchContent>(`${uid()}:content:${batchId}`, () => api<BatchContent>(`/api/batches/${batchId}/content`), {
    ttlMs: 2 * 60_000,
  });

export const useBatchTeachers = (batchId: string) =>
  useCachedQuery<BatchTeacher[]>(
    `${uid()}:batch-teachers:${batchId}`,
    () => api<BatchTeacher[]>(`/api/batches/${encodeURIComponent(batchId)}/teachers`),
    { ttlMs: 10 * 60_000 },
  );

export const paymentsKey = (forUid: string) => `${forUid}:payments`;

export const usePayments = () =>
  useCachedQuery<Payment[]>(paymentsKey(uid()), () => api<Payment[]>("/api/payments/mine"), { ttlMs: 60_000 });

export const useTestResult = (testId: string) =>
  useCachedQuery<TestResult>(`${uid()}:test-result:${testId}`, () => api<TestResult>(`/api/tests/${testId}/result`), {
    ttlMs: 60_000,
  });

export const useLeaderboard = (testId: string) =>
  useCachedQuery<LeaderboardRow[]>(`leaderboard:${testId}`, () => api<LeaderboardRow[]>(`/api/tests/${testId}/leaderboard`), {
    ttlMs: 60_000,
  });

export const useSubjects = () =>
  useCachedQuery<SubjectRow[]>(`${uid()}:subjects`, () => api<SubjectRow[]>("/api/subjects"), { ttlMs: 30 * 60_000 });
