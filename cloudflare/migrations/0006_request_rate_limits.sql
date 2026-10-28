CREATE TABLE IF NOT EXISTS request_rate_limits (
  namespace TEXT NOT NULL,
  key TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  window_end INTEGER NOT NULL,
  requests INTEGER NOT NULL CHECK (requests > 0),
  PRIMARY KEY (namespace, key, window_start)
);

CREATE INDEX IF NOT EXISTS request_rate_limits_window_end_idx ON request_rate_limits(window_end);
