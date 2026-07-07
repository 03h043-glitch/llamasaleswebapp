CREATE TABLE IF NOT EXISTS product_skus (
  model TEXT NOT NULL,
  size TEXT NOT NULL,
  sku TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (model, size)
);
