PRAGMA foreign_keys = ON;

CREATE TABLE teacher_applications (
  uid              TEXT PRIMARY KEY REFERENCES users(uid),
  subjects         TEXT NOT NULL,
  qualification    TEXT NOT NULL,
  experience_years INTEGER NOT NULL,
  phone            TEXT NOT NULL,
  bio              TEXT NOT NULL,
  demo_url         TEXT,
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','approved','rejected','suspended')),
  review_note      TEXT,
  reviewed_by      TEXT REFERENCES users(uid),
  reviewed_at      INTEGER,
  created_at       INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at       INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_teacher_apps_status ON teacher_applications(status, created_at);
