CREATE TABLE IF NOT EXISTS source_state (
  source_id TEXT PRIMARY KEY,
  last_attempt_at TEXT,
  last_success_at TEXT,
  next_due_at TEXT NOT NULL,
  last_error TEXT,
  last_record_count INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS observations (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('warning', 'earthquake', 'incident', 'hazard')),
  observed_at TEXT,
  expires_at TEXT,
  first_seen_at TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  FOREIGN KEY (source_id) REFERENCES source_state(source_id)
);
CREATE INDEX IF NOT EXISTS observations_kind_date ON observations(kind, observed_at DESC);
CREATE INDEX IF NOT EXISTS observations_expiry ON observations(first_seen_at);
CREATE INDEX IF NOT EXISTS observations_source ON observations(source_id, observed_at DESC);
CREATE TABLE IF NOT EXISTS regions (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('province', 'city-regency')),
  parent_code TEXT REFERENCES regions(code),
  code_edition TEXT NOT NULL,
  boundary_edition TEXT,
  svg_path TEXT
);
CREATE INDEX IF NOT EXISTS regions_parent ON regions(parent_code, name);
