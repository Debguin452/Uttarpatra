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
  banner_url: string | null;
  start_date: number | null;
  end_date: number | null;
  mrp_paise: number | null;
};

export type Lecture = {
  id: string;
  chapter: string;
  title_bn: string;
  title_en: string;
  // null while a scheduled lecture is still locked: the server withholds it
  youtube_id: string | null;
  duration_sec: number | null;
  is_live: number;
  live_at: number | null;
  subject_id: string | null;
  chapter_id: string | null;
  release_at: number | null;
  locked: number;
  order_index: number;
};

export type LiveLecture = {
  id: string;
  batch_id: string;
  batch_title_bn: string;
  batch_title_en: string;
  title_bn: string;
  title_en: string;
  youtube_id: string;
  live_at: number;
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
  photo_url: string | null;
  goal: string | null;
  district: string | null;
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
  is_teacher: 0 | 1;
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
  isTeacher: boolean;
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

export type TeacherStudentRow = {
  uid: string;
  name: string;
  phone: string | null;
  student_class: string | null;
  batches_with_me: number;
};

export type TeacherStudentDetail = {
  student: {
    uid: string;
    name: string;
    phone: string | null;
    student_class: string | null;
    board: string | null;
    school: string | null;
  };
  enrollments: { batch_id: string; title_bn: string; title_en: string; created_at: number }[];
  attempts: {
    title_bn: string;
    title_en: string;
    score: number;
    correct_count: number;
    wrong_count: number;
    submitted_at: number;
  }[];
};

export type TeacherDoubt = {
  id: string;
  uid: string;
  name: string;
  batch_id: string | null;
  batch_title_en: string | null;
  subject: string | null;
  question_text: string;
  image_drive_id: string | null;
  image_b64: string | null;
  status: "open" | "answered";
  answer_text: string | null;
  created_at: number;
};

export type MyDoubt = {
  id: string;
  batch_id: string | null;
  subject: string | null;
  question_text: string;
  image_drive_id: string | null;
  image_b64: string | null;
  status: "open" | "answered";
  answer_text: string | null;
  ai_answer: string | null;
  created_at: number;
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

export type BannerButtonRow = { labelBn: string; labelEn: string; url: string };

export type Banner = {
  id: string;
  kind: "launch" | "community";
  image_url: string;
  title_bn: string;
  title_en: string;
  description_bn: string | null;
  description_en: string | null;
  batch_id: string | null;
  link_url: string | null;
  target_type: "batch" | "test" | "lecture" | "material" | "link" | null;
  target_id: string | null;
  cta: "details" | "enroll";
  support_hours_bn: string | null;
  support_hours_en: string | null;
  phone: string | null;
  buttons: BannerButtonRow[];
  // The linked batch, so a launch banner can show its details without another request.
  batch_title_bn: string | null;
  batch_title_en: string | null;
  batch_track: string | null;
  batch_kind: "free" | "paid" | null;
  batch_price_paise: number | null;
  batch_mrp_paise: number | null;
  batch_start_date: number | null;
  batch_summary_bn: string | null;
  batch_summary_en: string | null;
};

export type NotificationItem = {
  id: string;
  kind: string;
  title_bn: string;
  title_en: string;
  body_bn: string | null;
  body_en: string | null;
  link: string | null;
  created_at: number;
  read: number;
  sender_name: string | null;
};

export type TestResult = {
  titleBn: string;
  titleEn: string;
  totalMarks: number;
  score: number;
  correct: number;
  wrong: number;
  skipped: number;
  timeTakenSec: number;
  rank: number | null;
  totalParticipants: number;
};

export type LeaderboardRow = {
  rank: number;
  uid: string;
  name: string;
  score: number;
};

export type BatchNote = {
  id: string;
  lecture_id: string | null;
  chapter_id: string | null;
  title_bn: string;
  title_en: string;
  drive_file_id: string;
  kind: string;
};

export type ContentSubject = { id: string; name_bn: string; name_en: string; sort_order: number };
export type Chapter = { id: string; subject_id: string; title_bn: string; title_en: string; order_index: number };
export type BatchContent = { lectures: Lecture[]; subjects: ContentSubject[]; chapters: Chapter[]; notes: BatchNote[] };

export type LectureProgress = {
  lecture_id: string;
  position_sec: number;
  duration_sec: number | null;
  completed: number;
  updated_at: number;
};

export type LearningSummary = {
  batch_id: string;
  title_bn: string;
  title_en: string;
  track: string;
  kind: string;
  banner_url: string | null;
  total: number;
  done: number;
  last_at: number | null;
};

export type MyBatch = Batch & { status: "published" | "archived"; expires_at: number | null };

export type SubjectRow = { id: string; name_bn: string; name_en: string; active: number; sort_order: number };

export type BatchTeacher = {
  name: string;
  photo_url: string | null;
  subject_bn: string | null;
  subject_en: string | null;
  qualification: string | null;
  experience_years: number | null;
  bio: string | null;
};
