import { z } from "zod";

export const Role = z.enum(["student", "teacher", "support", "super_admin"]);

export const ProfileUpsert = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().regex(/^[6-9][0-9]{9}$/, "Enter a 10-digit mobile number").optional(),
  studentClass: z.enum(["5", "6", "7", "8", "9", "10", "11", "12", "dropper"]).optional(),
  board: z.string().max(40).optional(),
  school: z.string().max(120).optional(),
  goal: z.enum(["neet", "jee", "cuet", "boards", "other"]).optional(),
  district: z.string().trim().max(60).optional(),
});
export type ProfileUpsert = z.infer<typeof ProfileUpsert>;

export const TRACKS = [
  "class5",
  "class6",
  "class7",
  "class8",
  "class9",
  "class10",
  "class11",
  "class12",
  "neet",
  "jee",
  "cuet",
  "crash",
  "one_shot",
] as const;
export const Track = z.enum(TRACKS);
export type Track = z.infer<typeof Track>;

export const Subject = z.string().regex(/^[a-z][a-z0-9_]{1,39}$/, "Invalid subject");
export type Subject = z.infer<typeof Subject>;

export const TeacherApplication = z.object({
  subjects: z.array(Subject).min(1).max(8),
  qualification: z.string().trim().min(2).max(120),
  experienceYears: z.number().int().min(0).max(60),
  phone: z.string().regex(/^[6-9][0-9]{9}$/, "Enter a 10-digit mobile number"),
  bio: z.string().trim().min(20).max(600),
  demoUrl: z.string().trim().url().max(300).regex(/^https?:\/\//, "Use an http or https link").optional(),
});
export type TeacherApplication = z.infer<typeof TeacherApplication>;

// What an approved teacher can change about their own public profile.
// Subjects stay with the admin, who assigns teachers to batches.
export const TeacherProfileUpdate = TeacherApplication.pick({
  qualification: true,
  experienceYears: true,
  phone: true,
  bio: true,
  demoUrl: true,
});
export type TeacherProfileUpdate = z.infer<typeof TeacherProfileUpdate>;

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
    track: Track,
    kind: z.enum(["paid", "free"]).default("paid"),
    pricePaise: z.number().int().min(0).default(0),
    summaryBn: z.string().max(2000).optional(),
    summaryEn: z.string().max(2000).optional(),
    previewVideoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/, "Not a YouTube video id").optional(),
    bannerUrl: z
      .string()
      .trim()
      .url()
      .max(500)
      .refine((url) => url.startsWith("https://"), "Use a link that starts with https://")
      .optional(),
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

export const SubjectUpsert = z.object({
  id: Subject,
  nameBn: z.string().trim().min(1).max(60),
  nameEn: z.string().trim().min(1).max(60),
  active: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(9999).default(100),
});
export type SubjectUpsert = z.infer<typeof SubjectUpsert>;
export const SubjectUpdate = SubjectUpsert.omit({ id: true });

export const TeacherAssign = z.object({
  uid: z.string().min(1),
  subject: Subject.optional(),
});

export const RoleUpdate = z.object({
  role: Role,
});
export type RoleUpdate = z.infer<typeof RoleUpdate>;

export const TeacherAccessUpdate = z.object({
  enabled: z.boolean(),
});
export type TeacherAccessUpdate = z.infer<typeof TeacherAccessUpdate>;

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

export const BANNER_TARGETS = ["batch", "test", "lecture", "material", "link"] as const;
export type BannerTarget = (typeof BANNER_TARGETS)[number];

export const BannerUpsert = z
  .object({
    imageUrl: z.string().trim().url().max(500),
    titleBn: z.string().trim().min(1).max(160),
    titleEn: z.string().trim().min(1).max(160),
    // What a tap opens. batchId / linkUrl are kept so older clients still work.
    targetType: z.enum(BANNER_TARGETS).nullable().optional(),
    targetId: z.string().min(1).max(80).nullable().optional(),
    batchId: z.string().min(1).nullable().optional(),
    linkUrl: z.string().trim().url().max(500).optional(),
    orderIndex: z.number().int().default(0),
    status: z.enum(["active", "inactive"]).default("active"),
  })
  .superRefine((value, ctx) => {
    const type = value.targetType ?? (value.batchId ? "batch" : value.linkUrl ? "link" : null);
    if (type === "link" && !value.linkUrl) ctx.addIssue({ code: "custom", path: ["linkUrl"], message: "Add the website link" });
    if (type && type !== "link" && !(value.targetId ?? value.batchId)) {
      ctx.addIssue({ code: "custom", path: ["targetId"], message: "Choose what the banner opens" });
    }
  });
export type BannerUpsert = z.infer<typeof BannerUpsert>;

export const LectureUpsert = z.object({
  batchId: z.string().min(1),
  chapter: z.string().trim().min(1).max(120),
  titleBn: z.string().trim().min(1).max(160),
  titleEn: z.string().trim().min(1).max(160),
  youtubeId: z.string().trim().min(1).max(60),
  durationSec: z.number().int().positive().optional(),
  orderIndex: z.number().int().default(0),
  isLive: z.boolean().default(false),
  liveAt: z.number().int().positive().nullable().optional(),
});
export type LectureUpsert = z.infer<typeof LectureUpsert>;

export const CouponUpsert = z.object({
  code: z
    .string()
    .trim()
    .min(3)
    .max(30)
    .transform((v) => v.toUpperCase()),
  discountType: z.enum(["percent", "flat"]),
  discountValue: z.number().int().positive(),
  maxUses: z.number().int().positive().nullable().optional(),
  validFrom: z.number().int().positive().nullable().optional(),
  validUntil: z.number().int().positive().nullable().optional(),
  batchId: z.string().min(1).nullable().optional(),
});
export type CouponUpsert = z.infer<typeof CouponUpsert>;

export const TestUpsert = z.object({
  batchId: z.string().min(1).nullable().optional(),
  titleBn: z.string().trim().min(1).max(160),
  titleEn: z.string().trim().min(1).max(160),
  kind: z.enum(["full_mock", "chapter", "daily_quiz", "pyq", "scholarship"]),
  durationSec: z.number().int().positive(),
  totalMarks: z.number().int().positive(),
  negativeMark: z.number().min(0).default(0),
  questions: z.array(BulkQuestionRow).min(1),
  opensAt: z.number().int().positive().nullable().optional(),
  closesAt: z.number().int().positive().nullable().optional(),
  status: z.enum(["draft", "scheduled", "live", "closed"]).default("draft"),
});
export type TestUpsert = z.infer<typeof TestUpsert>;

export const NoteUpsert = z.object({
  batchId: z.string().min(1).nullable().optional(),
  lectureId: z.string().min(1).nullable().optional(),
  titleBn: z.string().trim().min(1).max(160),
  titleEn: z.string().trim().min(1).max(160),
  driveFileId: z.string().trim().min(1).max(200),
  kind: z.enum(["note", "dpp", "flashcard", "formula"]).default("note"),
  isFree: z.boolean().default(false),
});
export type NoteUpsert = z.infer<typeof NoteUpsert>;

export const DoubtCreate = z.object({
  batchId: z.string().min(1).nullable().optional(),
  subject: Subject.optional(),
  questionText: z.string().trim().min(5).max(1000),
  imageDriveId: z.string().trim().max(200).optional(),
});
export type DoubtCreate = z.infer<typeof DoubtCreate>;

export const DoubtAnswer = z.object({
  answerText: z.string().trim().min(1).max(2000),
});
export type DoubtAnswer = z.infer<typeof DoubtAnswer>;

// A profile picture is either one of the built-in avatars ("preset:owl") or a
// small square photo the user chose, sent as a data URL (the app shrinks it
// to a few KB first). null removes it.
const AVATAR_PRESET = /^preset:[a-z0-9-]{1,24}$/;
const AVATAR_IMAGE = /^data:image\/(jpeg|webp|png);base64,[A-Za-z0-9+/]+={0,2}$/;
export const AvatarUpdate = z.object({
  photo: z
    .string()
    .max(40_000)
    .refine((value) => AVATAR_PRESET.test(value) || AVATAR_IMAGE.test(value), "Not a valid avatar")
    .nullable(),
});
export type AvatarUpdate = z.infer<typeof AvatarUpdate>;

export const QUOTA = {
  maxScreenshotBytes: 150_000,
  videoProgressWriteIntervalSec: 120,
  sessionTokenTtlSec: 15 * 60,
} as const;

export const PushTokenRegister = z.object({
  token: z.string().trim().min(10).max(4096),
  platform: z.enum(["web", "android"]).default("web"),
});
export type PushTokenRegister = z.infer<typeof PushTokenRegister>;

export const PushTokenUnregister = z.object({
  token: z.string().trim().min(1).max(4096),
});
export type PushTokenUnregister = z.infer<typeof PushTokenUnregister>;
