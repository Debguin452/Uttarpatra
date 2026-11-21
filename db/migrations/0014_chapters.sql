-- Groups a batch's lectures and notes under a subject, in order — the
-- Subject -> Chapter -> Lecture structure. Fully additive: chapter_id is
-- nullable everywhere, so existing lectures/notes keep working exactly as
-- they do today with no chapter set. subject_id already exists on
-- lectures (see 0010_learning.sql); chapters just adds a finer grouping
-- underneath it.

CREATE TABLE chapters (
  id          TEXT PRIMARY KEY,
  batch_id    TEXT NOT NULL REFERENCES batches(id),
  subject_id  TEXT NOT NULL REFERENCES subjects(id),
  title_bn    TEXT NOT NULL,
  title_en    TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_chapters_batch ON chapters(batch_id, order_index);

ALTER TABLE lectures ADD COLUMN chapter_id TEXT REFERENCES chapters(id);
CREATE INDEX idx_lectures_chapter ON lectures(chapter_id, order_index);

ALTER TABLE notes ADD COLUMN chapter_id TEXT REFERENCES chapters(id);
