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
