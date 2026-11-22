-- 1. Banners: two kinds (batch launch, community support), richer details,
--    a schedule, and what the call-to-action button does.
ALTER TABLE banners ADD COLUMN kind TEXT NOT NULL DEFAULT 'launch' CHECK (kind IN ('launch', 'community'));
ALTER TABLE banners ADD COLUMN description_bn TEXT;
ALTER TABLE banners ADD COLUMN description_en TEXT;
ALTER TABLE banners ADD COLUMN cta TEXT NOT NULL DEFAULT 'details' CHECK (cta IN ('details', 'enroll'));
ALTER TABLE banners ADD COLUMN starts_at INTEGER;
ALTER TABLE banners ADD COLUMN ends_at INTEGER;
ALTER TABLE banners ADD COLUMN support_hours_bn TEXT;
ALTER TABLE banners ADD COLUMN support_hours_en TEXT;
ALTER TABLE banners ADD COLUMN phone TEXT;
ALTER TABLE banners ADD COLUMN buttons_json TEXT;

-- 2. Batches: what a launch banner shows (start date, and the fee before discount).
ALTER TABLE batches ADD COLUMN start_date INTEGER;
ALTER TABLE batches ADD COLUMN end_date INTEGER;
ALTER TABLE batches ADD COLUMN mrp_paise INTEGER;

-- 3. Notifications. One row per message; who receives it is worked out from
--    the audience when someone opens their inbox, so sending to thousands of
--    students writes one row, not thousands.
CREATE TABLE notifications (
  id             TEXT PRIMARY KEY,
  sender_uid     TEXT REFERENCES users(uid),             -- NULL = the system
  kind           TEXT NOT NULL DEFAULT 'announcement',
  audience       TEXT NOT NULL CHECK (audience IN ('all', 'batch', 'class', 'user', 'teachers')),
  audience_value TEXT,                                   -- the class, or the user's uid
  batch_id       TEXT REFERENCES batches(id) ON DELETE CASCADE,
  title_bn       TEXT NOT NULL,
  title_en       TEXT NOT NULL,
  body_bn        TEXT,
  body_en        TEXT,
  link           TEXT,                                   -- an in-app route to open, e.g. "doubt"
  recipient_count INTEGER NOT NULL DEFAULT 0,
  created_at     INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_notifications_created ON notifications (created_at DESC);
CREATE INDEX idx_notifications_target ON notifications (audience, audience_value);
CREATE INDEX idx_notifications_batch ON notifications (batch_id);

CREATE TABLE notification_reads (
  uid             TEXT NOT NULL REFERENCES users(uid),
  notification_id TEXT NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  read_at         INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (uid, notification_id)
);
