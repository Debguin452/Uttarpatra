-- Push notification plumbing: device/browser FCM tokens, and dedupe markers
-- so the scheduled class-reminder job never sends the same alert twice.

CREATE TABLE push_tokens (
  uid        TEXT NOT NULL REFERENCES users(uid),
  token      TEXT NOT NULL,
  platform   TEXT NOT NULL DEFAULT 'web' CHECK (platform IN ('web', 'android')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (uid, token)
);

CREATE INDEX idx_push_tokens_uid ON push_tokens(uid);

-- Set once each alert has been sent for a given live lecture, so the
-- once-a-minute cron never double-sends the 15-minutes-before or the
-- class-starting-now alert.
ALTER TABLE lectures ADD COLUMN alert15_sent_at INTEGER;
ALTER TABLE lectures ADD COLUMN alertstart_sent_at INTEGER;
