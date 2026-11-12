import { z } from "zod";

export const Role = z.enum(["student", "teacher", "support", "super_admin"]);

export const ProfileUpsert = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().regex(/^[6-9][0-9]{9}$/, "Enter a 10-digit mobile number").optional(),
  studentClass: z.enum(["11", "12", "dropper"]).optional(),
  board: z.string().max(40).optional(),
  school: z.string().max(120).optional(),
});
export type ProfileUpsert = z.infer<typeof ProfileUpsert>;

export const ManualPaymentSubmit = z.object({
  batchId: z.string().min(1),
  utr: z.string().regex(/^[A-Za-z0-9]{10,22}$/, "UTR looks wrong — check the 12-digit reference in your UPI app"),
  couponCode: z.string().optional(),
  screenshotBase64: z.string().max(220_000, "Screenshot is too large even after compression"),
});
export type ManualPaymentSubmit = z.infer<typeof ManualPaymentSubmit>;

export const PaymentReview = z.object({
  paymentId: z.string().min(1),
  decision: z.enum(["approved", "rejected"]),
  note: z.string().max(280).optional(),
});

export const TestStart = z.object({
  testId: z.string().min(1),
});

export const AttemptSubmit = z.object({
  testId: z.string().min(1),
  answers: z.record(z.string(), z.string().nullable()),
});
export type AttemptSubmit = z.infer<typeof AttemptSubmit>;

export const BulkQuestionRow = z.object({
  subject: z.string().min(1),
  type: z.enum(["mcq", "assertion_reason", "true_false", "match", "case_based"]),
  prompt: z.string().min(1),
  options: z.array(z.string()).min(2).max(6),
  answer: z.string().min(1),
  marks: z.number().positive().default(4),
});
export type BulkQuestionRow = z.infer<typeof BulkQuestionRow>;

export const DeviceBind = z.object({
  deviceId: z.string().min(16),
  deviceLabel: z.string().max(80).optional(),
});

export const QUOTA = {
  maxScreenshotBytes: 150_000,
  videoProgressWriteIntervalSec: 120,
  sessionTokenTtlSec: 15 * 60,
} as const;
