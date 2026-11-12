-- Core schema for D1 (SQLite dialect).
-- Design rule: every write-heavy flow (test attempts, progress) is collapsed
-- into as few rows as possible, since D1's free tier caps at 100,000
-- row-writes/day. Read-heavy, low-write data lives here; per-user,
-- high-frequency data (streaks, bookmarks, video position) lives in
-- Firestore instead, straight from the client.

PRAGMA foreign_keys = ON;

-- ---------- Identity ----------
-- Firebase handles credentials; this table mirrors only what we need
-- to join against, keyed by the Firebase UID.
CREATE TABLE users (
  uid           TEXT PRIMARY KEY,         -- Firebase UID
  role          TEXT NOT NULL DEFAULT 'student'
                CHECK (role IN ('student','teacher','support','super_admin')),
  name          TEXT NOT NULL,
  phone         TEXT,
  student_class TEXT,                     -- '11' | '12' | 'dropper'
  board         TEXT,                     -- 'WBBSE' | 'CBSE' | ...
  school        TEXT,
  photo_url     TEXT,
  status        TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active','blocked')),
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE devices (
  uid           TEXT NOT NULL REFERENCES users(uid),
  device_id     TEXT NOT NULL,            -- stable client fingerprint
  device_label  TEXT,
  bound_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (uid)                       -- one row per user = single-device lock
);

-- ---------- Catalog ----------
CREATE TABLE batches (
  id            TEXT PRIMARY KEY,         -- slug, e.g. 'neet-2027-target'
  title_bn      TEXT NOT NULL,
  title_en      TEXT NOT NULL,
  track         TEXT NOT NULL CHECK (track IN ('class11','class12','neet','jee','crash','one_shot')),
  kind          TEXT NOT NULL DEFAULT 'paid' CHECK (kind IN ('paid','free')),
  price_paise   INTEGER NOT NULL DEFAULT 0,
  summary_bn    TEXT,
  summary_en    TEXT,
  syllabus_json TEXT,                     -- JSON array, rendered not queried
  preview_video_id TEXT,                  -- YouTube video id
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at    INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_batches_track_status ON batches(track, status);

CREATE TABLE batch_teachers (
  batch_id      TEXT NOT NULL REFERENCES batches(id),
  teacher_uid   TEXT NOT NULL REFERENCES users(uid),
  subject       TEXT,
  PRIMARY KEY (batch_id, teacher_uid)
);

CREATE TABLE lectures (
  id            TEXT PRIMARY KEY,
  batch_id      TEXT NOT NULL REFERENCES batches(id),
  chapter       TEXT NOT NULL,
  title_bn      TEXT NOT NULL,
  title_en      TEXT NOT NULL,
  youtube_id    TEXT NOT NULL,            -- unlisted video id
  duration_sec  INTEGER,
  order_index   INTEGER NOT NULL DEFAULT 0,
  is_live       INTEGER NOT NULL DEFAULT 0,
  live_at       INTEGER,                   -- unix ts, null if recorded
  created_at    INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_lectures_batch ON lectures(batch_id, order_index);

CREATE TABLE notes (
  id            TEXT PRIMARY KEY,
  batch_id      TEXT REFERENCES batches(id),   -- null = public/free resource
  lecture_id    TEXT REFERENCES lectures(id),
  title_bn      TEXT NOT NULL,
  title_en      TEXT NOT NULL,
  drive_file_id TEXT NOT NULL,             -- Google Drive file id
  is_free       INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_notes_batch ON notes(batch_id);

-- ---------- Enrollment & payments (manual UPI first, Razorpay later) ----------
CREATE TABLE enrollments (
  uid           TEXT NOT NULL REFERENCES users(uid),
  batch_id      TEXT NOT NULL REFERENCES batches(id),
  granted_by    TEXT NOT NULL DEFAULT 'payment' CHECK (granted_by IN ('payment','admin','referral','free')),
  expires_at    INTEGER,                   -- null = lifetime access
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (uid, batch_id)
);

CREATE TABLE payments (
  id            TEXT PRIMARY KEY,          -- ULID
  uid           TEXT NOT NULL REFERENCES users(uid),
  batch_id      TEXT NOT NULL REFERENCES batches(id),
  method        TEXT NOT NULL CHECK (method IN ('manual_upi','razorpay')),
  amount_paise  INTEGER NOT NULL,
  coupon_code   TEXT,
  utr           TEXT,                      -- unique: blocks duplicate/reused UTR
  screenshot_b64 TEXT,                     -- compressed client-side to <=150KB
  razorpay_order_id   TEXT,
  razorpay_payment_id TEXT,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','approved','rejected','refunded')),
  reviewed_by   TEXT REFERENCES users(uid),
  reviewed_at   INTEGER,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE UNIQUE INDEX idx_payments_utr ON payments(utr) WHERE utr IS NOT NULL;
CREATE INDEX idx_payments_status ON payments(status, created_at);
CREATE INDEX idx_payments_uid ON payments(uid);

CREATE TABLE coupons (
  code          TEXT PRIMARY KEY,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percent','flat')),
  discount_value INTEGER NOT NULL,
  max_uses      INTEGER,
  used_count    INTEGER NOT NULL DEFAULT 0,
  valid_from    INTEGER,
  valid_until   INTEGER,
  batch_id      TEXT REFERENCES batches(id)  -- null = applies to all batches
);

-- ---------- Tests ----------
-- One row per test; questions as a single JSON document (keeps reads to
-- one row). This trades normalization for staying inside D1's row-read
-- budget on exam day, when hundreds of students load the same test.
CREATE TABLE tests (
  id            TEXT PRIMARY KEY,
  batch_id      TEXT REFERENCES batches(id),   -- null = open test series
  title_bn      TEXT NOT NULL,
  title_en      TEXT NOT NULL,
  kind          TEXT NOT NULL CHECK (kind IN ('full_mock','chapter','daily_quiz','pyq','scholarship')),
  duration_sec  INTEGER NOT NULL,
  total_marks   INTEGER NOT NULL,
  negative_mark REAL NOT NULL DEFAULT 0,
  questions_json TEXT NOT NULL,            -- [{id, type, prompt, options[], answer, marks, subject}]
  opens_at      INTEGER,
  closes_at     INTEGER,
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','live','closed')),
  created_at    INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_tests_batch_status ON tests(batch_id, status);

-- One row per attempt; answers collapsed into one JSON blob so a submit
-- is a single write, not one write per question.
CREATE TABLE attempts (
  id            TEXT PRIMARY KEY,          -- ULID
  test_id       TEXT NOT NULL REFERENCES tests(id),
  uid           TEXT NOT NULL REFERENCES users(uid),
  answers_json  TEXT NOT NULL DEFAULT '{}',
  score         REAL,
  correct_count INTEGER,
  wrong_count   INTEGER,
  skipped_count INTEGER,
  time_taken_sec INTEGER,
  started_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  submitted_at  INTEGER,
  UNIQUE (test_id, uid)
);
CREATE INDEX idx_attempts_test ON attempts(test_id, score DESC);

-- Precomputed once when a test closes; read by every student's result
-- screen without re-scanning all attempts.
CREATE TABLE leaderboard_snapshots (
  test_id       TEXT PRIMARY KEY REFERENCES tests(id),
  rows_json     TEXT NOT NULL,             -- [{uid, name, score, rank}]
  computed_at   INTEGER NOT NULL DEFAULT (unixepoch())
);

-- ---------- Doubts & notices ----------
CREATE TABLE doubts (
  id            TEXT PRIMARY KEY,
  uid           TEXT NOT NULL REFERENCES users(uid),
  batch_id      TEXT REFERENCES batches(id),
  subject       TEXT,
  question_text TEXT,
  image_drive_id TEXT,
  status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','answered')),
  answered_by   TEXT REFERENCES users(uid),
  answer_text   TEXT,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_doubts_status ON doubts(status, created_at);

CREATE TABLE notices (
  id            TEXT PRIMARY KEY,
  title_bn      TEXT NOT NULL,
  title_en      TEXT NOT NULL,
  body_bn       TEXT,
  body_en       TEXT,
  batch_id      TEXT REFERENCES batches(id),  -- null = all students
  pinned        INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_notices_batch ON notices(batch_id, created_at DESC);

-- ---------- Audit (admin accountability) ----------
CREATE TABLE audit_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_uid     TEXT NOT NULL,
  action        TEXT NOT NULL,             -- 'payment.approve', 'user.block', ...
  target        TEXT,
  meta_json     TEXT,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_audit_actor ON audit_log(actor_uid, created_at DESC);
