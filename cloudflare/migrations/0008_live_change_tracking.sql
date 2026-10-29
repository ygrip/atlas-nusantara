-- Lets the live refresh skip work when a source has nothing new: a content hash per forecast point and per live publication.
ALTER TABLE forecast_points ADD COLUMN steps_hash TEXT;
CREATE TABLE IF NOT EXISTS live_state (
  key TEXT PRIMARY KEY,
  content_hash TEXT NOT NULL,
  changed_at TEXT NOT NULL
);
