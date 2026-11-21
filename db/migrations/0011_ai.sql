-- Cloudflare Workers AI: a daily usage counter (per person, and one row for the
-- whole app under uid '*') to keep costs predictable, a shared cache of question
-- explanations, and the AI answer stored on a doubt.
CREATE TABLE ai_usage (
  day   TEXT NOT NULL,
  uid   TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, uid)
);

CREATE TABLE ai_explanations (
  test_id     TEXT NOT NULL,
  question_id TEXT NOT NULL,
  lang        TEXT NOT NULL,
  text        TEXT NOT NULL,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (test_id, question_id, lang)
);

ALTER TABLE doubts ADD COLUMN ai_answer TEXT;
ALTER TABLE doubts ADD COLUMN ai_answered_at INTEGER;
