CREATE TABLE IF NOT EXISTS publications (
  key TEXT PRIMARY KEY,
  payload_json TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  valid_until TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS publications_valid_until_idx ON publications(valid_until);
