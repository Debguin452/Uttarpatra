import type { Track } from "@coaching-app/shared/schema";

export type BatchStatus = "draft" | "published" | "archived";

export type AdminBatchRow = {
  id: string;
  title_bn: string;
  title_en: string;
  track: Track;
  kind: "paid" | "free";
  price_paise: number;
  status: BatchStatus;
  created_at: number;
  enrollment_count: number;
  teacher_count: number;
};

export type AdminBatchDetail = {
  batch: {
    id: string;
    title_bn: string;
    title_en: string;
    track: Track;
    kind: "paid" | "free";
    price_paise: number;
    summary_bn: string | null;
    summary_en: string | null;
    preview_video_id: string | null;
    banner_url: string | null;
    status: BatchStatus;
    created_at: number;
    updated_at: number;
  };
  teachers: { uid: string; name: string; subject: string | null }[];
};

export type AdminNotice = {
  id: string;
  title_bn: string;
  title_en: string;
  body_bn: string | null;
  body_en: string | null;
  batch_id: string | null;
  batch_title_en: string | null;
  pinned: number;
  created_at: number;
};

export type AdminSubject = {
  id: string;
  name_bn: string;
  name_en: string;
  active: number;
  sort_order: number;
  assignment_count: number;
};

export type AdminNote = {
  id: string;
  batch_id: string | null;
  batch_title_en: string | null;
  lecture_id: string | null;
  title_bn: string;
  title_en: string;
  drive_file_id: string;
  kind: "note" | "dpp" | "flashcard" | "formula";
  is_free: number;
  created_at: number;
};

export type AdminLecture = {
  id: string;
  batch_id: string;
  batch_title_en: string;
  chapter: string;
  title_bn: string;
  title_en: string;
  youtube_id: string;
  duration_sec: number | null;
  order_index: number;
  is_live: number;
  live_at: number | null;
  created_at: number;
};

export type AdminCoupon = {
  code: string;
  discount_type: "percent" | "flat";
  discount_value: number;
  max_uses: number | null;
  used_count: number;
  valid_from: number | null;
  valid_until: number | null;
  batch_id: string | null;
  batch_title_en: string | null;
};

export type AdminTestRow = {
  id: string;
  batch_id: string | null;
  batch_title_en: string | null;
  title_bn: string;
  title_en: string;
  kind: "full_mock" | "chapter" | "daily_quiz" | "pyq" | "scholarship";
  duration_sec: number;
  total_marks: number;
  negative_mark: number;
  opens_at: number | null;
  closes_at: number | null;
  status: "draft" | "scheduled" | "live" | "closed";
  created_at: number;
  attempt_count: number;
};

export type AdminTestQuestion = {
  id?: string;
  subject: string;
  type: "mcq" | "assertion_reason" | "true_false" | "match" | "case_based";
  prompt: string;
  options: string[];
  answer: string;
  marks: number;
};

export type AdminTestDetail = {
  id: string;
  batch_id: string | null;
  title_bn: string;
  title_en: string;
  kind: AdminTestRow["kind"];
  duration_sec: number;
  total_marks: number;
  negative_mark: number;
  questions_json: string;
  opens_at: number | null;
  closes_at: number | null;
  status: AdminTestRow["status"];
};

export type AdminBanner = {
  id: string;
  image_url: string;
  title_bn: string;
  title_en: string;
  batch_id: string | null;
  link_url: string | null;
  order_index: number;
  status: "active" | "inactive";
  created_at: number;
};

export type AuditLogEntry = {
  id: number;
  actor_uid: string;
  actor_name: string | null;
  action: string;
  target: string;
  meta_json: string | null;
  created_at: number;
};

export type AuditLogPage = { entries: AuditLogEntry[]; nextCursor: number | null };
