CREATE TABLE IF NOT EXISTS commission_rate_history (
  item_type TEXT NOT NULL,
  model TEXT NOT NULL,
  size TEXT NOT NULL DEFAULT '',
  effective_from TEXT NOT NULL,
  value REAL NOT NULL DEFAULT 0,
  cleared INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (item_type, model, size, effective_from)
);

CREATE INDEX IF NOT EXISTS idx_commission_rate_history_effective
  ON commission_rate_history (item_type, model, size, effective_from);

INSERT OR IGNORE INTO commission_rate_history (
  item_type,
  model,
  size,
  effective_from,
  value,
  cleared,
  created_at
)
SELECT
  item_type,
  model,
  size,
  '1970-01-01',
  value,
  0,
  0
FROM commission_rates;
