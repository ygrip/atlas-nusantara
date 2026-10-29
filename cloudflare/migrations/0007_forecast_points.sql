-- One row per forecast point so the Worker can refresh the national forecast a few points per cron tick (free-plan subrequest limit).
-- attempted_at rotates the queue (failed points too); fetched_at/payload_json hold the last good forecast and are NULL until one succeeds.
CREATE TABLE IF NOT EXISTS forecast_points (
  code TEXT PRIMARY KEY,
  attempted_at TEXT NOT NULL,
  fetched_at TEXT,
  first_at TEXT,
  last_at TEXT,
  payload_json TEXT
);
