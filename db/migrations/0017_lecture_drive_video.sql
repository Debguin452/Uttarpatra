-- A lecture's video can now be a Google Drive file instead of a YouTube
-- upload (some teachers only ever record to Drive). youtube_id stays
-- NOT NULL (SQLite can't relax that with ALTER TABLE without rebuilding the
-- whole table) -- the app writes '' there for a Drive-sourced lecture and
-- treats '' the same as absent.
ALTER TABLE lectures ADD COLUMN source TEXT NOT NULL DEFAULT 'youtube';
ALTER TABLE lectures ADD COLUMN drive_file_id TEXT;
