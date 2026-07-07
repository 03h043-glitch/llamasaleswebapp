CREATE TABLE IF NOT EXISTS barcodes (
  id TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  code TEXT NOT NULL,
  applies_to TEXT NOT NULL DEFAULT '[]',
  created_by TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_barcodes_dates ON barcodes (start_date, end_date);
