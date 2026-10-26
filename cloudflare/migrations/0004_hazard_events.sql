-- Cleaned disaster events and BMKG CAP warnings collected by the per-source hazard schedule.
-- Per-source timing reuses source_state (source_id 'hazard:<id>'); this table holds the stored records that are re-aggregated into hazards.json.
CREATE TABLE IF NOT EXISTS hazard_events (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('event', 'warning')),
  occurred_at TEXT NOT NULL,
  expires_at TEXT,
  last_seen_at TEXT NOT NULL,
  payload_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS hazard_events_source ON hazard_events(source_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS hazard_events_kind ON hazard_events(kind, occurred_at DESC);
