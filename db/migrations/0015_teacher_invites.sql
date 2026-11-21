-- An admin invites a teacher by email before that person has ever signed in.
-- The row is claimed (and deleted) the moment someone registers with a
-- matching email: their account becomes a teacher immediately, no
-- application or review needed, since an admin already vetted them.
CREATE TABLE teacher_invites (
  email         TEXT PRIMARY KEY,
  subjects_json TEXT NOT NULL,
  invited_by    TEXT NOT NULL REFERENCES users(uid),
  created_at    INTEGER NOT NULL DEFAULT (unixepoch())
);
