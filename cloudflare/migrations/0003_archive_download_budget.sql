CREATE INDEX IF NOT EXISTS observations_archive_window ON observations(kind, COALESCE(observed_at, first_seen_at), id);
CREATE TABLE IF NOT EXISTS archive_download_budget (
  day TEXT PRIMARY KEY,
  downloads INTEGER NOT NULL CHECK (downloads >= 0)
);
