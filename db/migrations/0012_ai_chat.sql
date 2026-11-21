-- A student's AI study chat. The history lives here, on the server, so the
-- app can never send a made-up "assistant" turn to steer the model.
CREATE TABLE ai_messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  uid        TEXT NOT NULL REFERENCES users(uid),
  role       TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content    TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_ai_messages_uid ON ai_messages (uid, id);
