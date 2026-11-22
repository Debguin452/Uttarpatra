export const meKey = (userId: string) => `${userId}:me`;
export const paymentsKey = (userId: string) => `${userId}:payments`;
export const myBatchesKey = (userId: string) => `${userId}:my-batches`;
export const progressKey = (userId: string, batchId: string) => `${userId}:progress:${batchId}`;
export const learningSummaryKey = (userId: string) => `${userId}:learning-summary`;
