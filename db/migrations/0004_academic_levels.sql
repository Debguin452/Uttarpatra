PRAGMA defer_foreign_keys = on;

CREATE TABLE batches_stash AS SELECT * FROM batches;

DROP TABLE batches;

CREATE TABLE batches (
  id            TEXT PRIMARY KEY,
  title_bn      TEXT NOT NULL,
  title_en      TEXT NOT NULL,
  track         TEXT NOT NULL CHECK (track IN (
                  'class5','class6','class7','class8','class9','class10','class11','class12',
                  'neet','jee','cuet','crash','one_shot')),
  kind          TEXT NOT NULL DEFAULT 'paid' CHECK (kind IN ('paid','free')),
  price_paise   INTEGER NOT NULL DEFAULT 0,
  summary_bn    TEXT,
  summary_en    TEXT,
  syllabus_json TEXT,
  preview_video_id TEXT,
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

INSERT INTO batches
  (id, title_bn, title_en, track, kind, price_paise, summary_bn, summary_en, syllabus_json,
   preview_video_id, status, created_at, updated_at)
SELECT id, title_bn, title_en, track, kind, price_paise, summary_bn, summary_en, syllabus_json,
       preview_video_id, status, created_at, updated_at
FROM batches_stash;

DROP TABLE batches_stash;

CREATE INDEX idx_batches_track_status ON batches(track, status);

CREATE TABLE subjects (
  id          TEXT PRIMARY KEY,
  name_bn     TEXT NOT NULL,
  name_en     TEXT NOT NULL,
  active      INTEGER NOT NULL DEFAULT 1,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

INSERT INTO subjects (id, name_bn, name_en, sort_order) VALUES
  ('physics', 'পদার্থবিদ্যা', 'Physics', 10),
  ('chemistry', 'রসায়ন', 'Chemistry', 20),
  ('biology', 'জীববিদ্যা', 'Biology', 30),
  ('mathematics', 'গণিত', 'Mathematics', 40),
  ('science', 'বিজ্ঞান', 'Science', 50),
  ('english', 'ইংরেজি', 'English', 60),
  ('bengali', 'বাংলা', 'Bengali', 70),
  ('hindi', 'হিন্দি', 'Hindi', 80),
  ('social_science', 'সমাজবিজ্ঞান', 'Social Science', 90),
  ('history', 'ইতিহাস', 'History', 100),
  ('geography', 'ভূগোল', 'Geography', 110),
  ('political_science', 'রাষ্ট্রবিজ্ঞান', 'Political Science', 120),
  ('economics', 'অর্থনীতি', 'Economics', 130),
  ('accountancy', 'হিসাবশাস্ত্র', 'Accountancy', 140),
  ('business_studies', 'ব্যবসায় শিক্ষা', 'Business Studies', 150),
  ('computer_science', 'কম্পিউটার বিজ্ঞান', 'Computer Science', 160),
  ('sociology', 'সমাজতত্ত্ব', 'Sociology', 170),
  ('psychology', 'মনোবিজ্ঞান', 'Psychology', 180),
  ('general_test', 'সাধারণ জ্ঞান', 'General Test', 190);
