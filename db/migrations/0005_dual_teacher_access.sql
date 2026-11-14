-- Lets a support/super_admin account also hold teacher access, without
-- giving up their admin role. Separate from `role` on purpose: role still
-- drives the primary UI (AdminShell vs student app), while is_teacher is
-- an add-on permission checked by requireTeacherAccess().
ALTER TABLE users ADD COLUMN is_teacher INTEGER NOT NULL DEFAULT 0;

CREATE INDEX idx_users_is_teacher ON users(is_teacher) WHERE is_teacher = 1;
