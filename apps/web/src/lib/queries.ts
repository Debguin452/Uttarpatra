import { useCachedQuery } from "@coaching-app/shared/cache/useCachedQuery";
import { api } from "./api";
import { uid } from "./session";
import { testsKey } from "./testCache";
import type { Batch, Lecture, Notice, Payment, TestRow } from "./types";

export const useBatches = () =>
  useCachedQuery<Batch[]>("public:batches", () => api<Batch[]>("/public/batches", { auth: false }));

export const useNotices = () => useCachedQuery<Notice[]>(`${uid()}:notices`, () => api<Notice[]>("/api/notices"));

export const useTests = () =>
  useCachedQuery<TestRow[]>(testsKey(uid()), () => api<TestRow[]>("/api/tests"), { ttlMs: 0 });

export const useLectures = (batchId: string) =>
  useCachedQuery<Lecture[]>(`${uid()}:lectures:${batchId}`, () => api<Lecture[]>(`/api/batches/${batchId}/content`), {
    ttlMs: 2 * 60_000,
  });

export const usePayments = () =>
  useCachedQuery<Payment[]>(`${uid()}:payments`, () => api<Payment[]>("/api/payments/mine"), { ttlMs: 60_000 });
