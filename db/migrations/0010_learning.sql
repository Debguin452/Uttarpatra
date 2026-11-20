-- Batch-centric learning: lectures belong to a subject, can be drafts or
-- scheduled for release, and every student's watching progress is saved.
ALTER TABLE lectures ADD COLUMN subject_id TEXT REFERENCES subjects(id);
ALTER TABLE lectures ADD COLUMN status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published'));
ALTER TABLE lectures ADD COLUMN release_at INTEGER;

CREATE TABLE lecture_progress (
  uid          TEXT NOT NULL REFERENCES users(uid),
  lecture_id   TEXT NOT NULL REFERENCES lectures(id) ON DELETE CASCADE,
  batch_id     TEXT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  position_sec INTEGER NOT NULL DEFAULT 0,
  duration_sec INTEGER,
  completed_at INTEGER,
  updated_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (uid, lecture_id)
);
CREATE INDEX idx_lecture_progress_batch ON lecture_progress (uid, batch_id);
