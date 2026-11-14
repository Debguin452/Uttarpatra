import type { Subject, Track } from "@coaching-app/shared/schema";

export type { Track };

export type Batch = {
  id: string;
  title_bn: string;
  title_en: string;
  track: Track;
  kind: "paid" | "free";
  price_paise: number;
  summary_bn: string | null;
  summary_en: string | null;
  preview_video_id: string | null;
};

export type Lecture = {
  id: string;
  chapter: string;
  title_bn: string;
  title_en: string;
  youtube_id: string;
  duration_sec: number | null;
  is_live: number;
  live_at: number | null;
};

export type Notice = {
  id: string;
  title_bn: string;
  title_en: string;
  body_bn: string | null;
  body_en: string | null;
  pinned: number;
  created_at: number;
};

export type TestRow = {
  id: string;
  batch_id: string | null;
  title_bn: string;
  title_en: string;
  kind: string;
  duration_sec: number;
  total_marks: number;
  negative_mark: number;
  opens_at: number | null;
  closes_at: number | null;
  status: "live" | "closed";
  score: number | null;
  submitted_at: number | null;
};

export type Payment = {
  id: string;
  batch_id: string;
  amount_paise: number;
  status: "pending" | "approved" | "rejected" | "refunded";
  created_at: number;
};

export type UserRow = {
  uid: string;
  role: string;
  name: string;
  phone: string | null;
  student_class: string | null;
  board: string | null;
  school: string | null;
};

export type AdminPayment = {
  id: string;
  uid: string;
  name: string;
  batch_id: string;
  amount_paise: number;
  utr: string | null;
  coupon_code: string | null;
  created_at: number;
};

export type AdminUser = {
  uid: string;
  name: string;
  phone: string | null;
  role: string;
  status: "active" | "blocked";
  device_bound: 0 | 1;
  bound_at: number | null;
};

export type TeacherApplicationView = {
  subjects: Subject[];
  qualification: string;
  experience_years: number;
  phone: string;
  bio: string;
  demo_url: string | null;
  status: "pending" | "approved" | "rejected" | "suspended";
  review_note: string | null;
  created_at: number;
};

export type TeacherPortal = {
  role: string;
  application: TeacherApplicationView | null;
  batches: { id: string; title_bn: string; title_en: string; subject: string | null }[];
};

export type AdminTeacherApplication = {
  uid: string;
  name: string;
  subjects: Subject[];
  qualification: string;
  experience_years: number;
  phone: string;
  bio: string;
  demo_url: string | null;
  created_at: number;
};

export type AdminTeacher = {
  uid: string;
  name: string;
  phone: string | null;
  subjects: Subject[] | null;
  experience_years: number | null;
  batch_count: number;
};

export type Me =
  | { registered: false }
  | { registered: true; user: UserRow; enrollments: { batch_id: string; expires_at: number | null }[] };

export type StartedTest = {
  attemptId: string;
  testId: string;
  titleBn: string;
  titleEn: string;
  startedAt: number;
  serverNow: number;
  durationSec: number;
  totalMarks: number;
  negativeMark: number;
  questions: { id: string; type: string; subject: string; prompt: string; options: string[]; marks: number }[];
};

export type SubmitResult = {
  score: number;
  correct: number;
  wrong: number;
  skipped: number;
  totalQuestions: number;
  totalMarks: number;
  timeTakenSec: number;
  onTime: boolean;
};

export type BatchNote = {
  id: string;
  lecture_id: string | null;
  title_bn: string;
  title_en: string;
  drive_file_id: string;
  kind: string;
};

export type BatchContent = { lectures: Lecture[]; notes: BatchNote[] };

export type MyBatch = Batch & { status: "published" | "archived"; expires_at: number | null };

export type SubjectRow = { id: string; name_bn: string; name_en: string; active: number; sort_order: number };
