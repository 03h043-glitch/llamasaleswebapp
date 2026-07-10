CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  username TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  email TEXT NOT NULL,
  region TEXT NOT NULL,
  store TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  brand TEXT NOT NULL,
  item_type TEXT NOT NULL DEFAULT 'tv',
  model TEXT NOT NULL DEFAULT '',
  size TEXT NOT NULL DEFAULT '',
  price REAL NOT NULL DEFAULT 0,
  refund INTEGER NOT NULL DEFAULT 0,
  username TEXT NOT NULL,
  region TEXT NOT NULL,
  store TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS commission_rates (
  item_type TEXT NOT NULL,
  model TEXT NOT NULL,
  size TEXT NOT NULL DEFAULT '',
  value REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (item_type, model, size)
);

CREATE TABLE IF NOT EXISTS product_models (
  item_type TEXT NOT NULL,
  model TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (item_type, model)
);

CREATE TABLE IF NOT EXISTS product_sizes (
  size TEXT PRIMARY KEY,
  sort_order INTEGER NOT NULL DEFAULT 0
);

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

CREATE TABLE IF NOT EXISTS product_skus (
  model TEXT NOT NULL,
  size TEXT NOT NULL,
  sku TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (model, size)
);

CREATE INDEX IF NOT EXISTS idx_sales_username_date ON sales (username, date);
CREATE INDEX IF NOT EXISTS idx_sales_region_store_date ON sales (region, store, date);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales (date);
CREATE INDEX IF NOT EXISTS idx_barcodes_dates ON barcodes (start_date, end_date);

INSERT OR IGNORE INTO product_models (item_type, model, category, sort_order) VALUES
  ('tv', 'A4Q', 'UHD', 10),
  ('tv', 'A5Q', 'UHD', 20),
  ('tv', 'A6Q', 'UHD', 30),
  ('tv', 'A7Q', 'QLED', 40),
  ('tv', 'E7Q', 'QLED', 50),
  ('tv', 'E7Q Pro', 'QLED', 60),
  ('tv', 'U7Q', 'MINI LED', 70),
  ('tv', 'U7Q Pro', 'MINI LED', 80),
  ('tv', 'U8Q', 'MINI LED', 90),
  ('tv', 'U7S', 'MINI LED', 100),
  ('tv', 'U7S Pro', 'MINI LED', 110),
  ('tv', 'UR8S', 'RGB', 120),
  ('tv', 'UR9S', 'RGB', 130),
  ('tv', 'C2', 'LASER', 140),
  ('tv', 'C2 Ultra', 'LASER', 150),
  ('tv', 'Other', '', 999),
  ('soundbar', 'AX3100Q', '', 10),
  ('soundbar', 'AX5100Q', '', 20),
  ('soundbar', 'AX5125H', '', 30),
  ('soundbar', 'AX5125Q', '', 40),
  ('soundbar', 'AX7100Q', '', 50),
  ('soundbar', 'AX8100Q', '', 60),
  ('soundbar', 'Other', '', 999);

INSERT OR IGNORE INTO product_sizes (size, sort_order) VALUES
  ('32', 10),
  ('40', 20),
  ('43', 30),
  ('50', 40),
  ('55', 50),
  ('65', 60),
  ('75', 70),
  ('85', 80),
  ('100', 90),
  ('Other', 999);
