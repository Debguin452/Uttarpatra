import { useCachedQuery } from "@coaching-app/shared/cache/useCachedQuery";
import { api } from "./api";
import { uid } from "./session";
import { testsKey } from "./testCache";
import type { Batch, BatchContent, LiveLecture, MyBatch, Notice, Payment, PublicBanner, SubjectRow, TestRow } from "./types";

export const useBatches = () =>
  useCachedQuery<Batch[]>("public:batches", () => api<Batch[]>("/public/batches", { auth: false }));

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

export const usePayments = () =>
  useCachedQuery<Payment[]>(paymentsKey(uid()), () => api<Payment[]>("/api/payments/mine"), { ttlMs: 60_000 });

export const useSubjects = () =>
  useCachedQuery<SubjectRow[]>(`${uid()}:subjects`, () => api<SubjectRow[]>("/api/subjects"), { ttlMs: 30 * 60_000 });

export const useBanners = () =>
  useCachedQuery<PublicBanner[]>("public:banners", () => api<PublicBanner[]>("/public/banners", { auth: false }), {
    ttlMs: 5 * 60_000,
  });

export const paymentsKey = (userId: string) => `${userId}:payments`;
export const myBatchesKey = (userId: string) => `${userId}:my-batches`;
