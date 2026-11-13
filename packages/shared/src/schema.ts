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

export const Subject = z.enum(["physics", "chemistry", "biology", "mathematics"]);
export type Subject = z.infer<typeof Subject>;

export const TeacherApplication = z.object({
  subjects: z.array(Subject).min(1).max(4),
  qualification: z.string().trim().min(2).max(120),
  experienceYears: z.number().int().min(0).max(60),
  phone: z.string().regex(/^[6-9][0-9]{9}$/, "Enter a 10-digit mobile number"),
  bio: z.string().trim().min(20).max(600),
  demoUrl: z.string().trim().url().max(300).regex(/^https?:\/\//, "Use an http or https link").optional(),
});
export type TeacherApplication = z.infer<typeof TeacherApplication>;

export const TeacherReview = z.object({
  uid: z.string().min(1),
  decision: z.enum(["approved", "rejected"]),
  note: z.string().trim().max(300).optional(),
});

export const NoticeUpsert = z.object({
  titleBn: z.string().trim().min(1).max(200),
  titleEn: z.string().trim().min(1).max(200),
  bodyBn: z.string().max(4000).optional(),
  bodyEn: z.string().max(4000).optional(),
  batchId: z.string().min(1).nullable().optional(),
  pinned: z.boolean().default(false),
});
export type NoticeUpsert = z.infer<typeof NoticeUpsert>;

export const BatchUpsert = z
  .object({
    id: z.string().regex(/^[a-z0-9-]{3,60}$/, "Use lowercase letters, numbers and hyphens only"),
    titleBn: z.string().trim().min(1).max(120),
    titleEn: z.string().trim().min(1).max(120),
    track: z.enum(["class11", "class12", "neet", "jee", "crash", "one_shot"]),
    kind: z.enum(["paid", "free"]).default("paid"),
    pricePaise: z.number().int().min(0).default(0),
    summaryBn: z.string().max(2000).optional(),
    summaryEn: z.string().max(2000).optional(),
    previewVideoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/, "Not a YouTube video id").optional(),
    status: z.enum(["draft", "published", "archived"]).default("draft"),
  })
  .superRefine((batch, ctx) => {
    if (batch.kind === "paid" && batch.pricePaise <= 0) {
      ctx.addIssue({ code: "custom", path: ["pricePaise"], message: "Paid batches need a price" });
    }
    if (batch.kind === "free" && batch.pricePaise !== 0) {
      ctx.addIssue({ code: "custom", path: ["pricePaise"], message: "Free batches must cost nothing" });
    }
  });
export type BatchUpsert = z.infer<typeof BatchUpsert>;

export const TeacherAssign = z.object({
  uid: z.string().min(1),
  subject: Subject.optional(),
});

export const RoleUpdate = z.object({
  role: Role,
});
export type RoleUpdate = z.infer<typeof RoleUpdate>;

export const EnrollGrant = z.object({
  batchId: z.string().min(1),
  expiresAt: z.number().int().positive().nullable().optional(),
});
export type EnrollGrant = z.infer<typeof EnrollGrant>;

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
