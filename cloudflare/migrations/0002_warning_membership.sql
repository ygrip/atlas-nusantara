ALTER TABLE observations ADD COLUMN last_seen_at TEXT;
CREATE INDEX IF NOT EXISTS observations_current_warning ON observations(source_id, last_seen_at, expires_at);
