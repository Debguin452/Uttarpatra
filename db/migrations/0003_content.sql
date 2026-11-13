PRAGMA foreign_keys = ON;

ALTER TABLE notes ADD COLUMN kind TEXT NOT NULL DEFAULT 'note';

CREATE TABLE banners (
  id            TEXT PRIMARY KEY,
  image_url     TEXT NOT NULL,
  title_bn      TEXT NOT NULL,
  title_en      TEXT NOT NULL,
  batch_id      TEXT REFERENCES batches(id),   -- null = links out via link_url instead
  link_url      TEXT,
  order_index   INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at    INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_banners_status ON banners(status, order_index);
