PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('ETF', 'ETN', 'stock', 'spot-index', 'futures-index')),
  source TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS assets_symbol_type_idx ON assets(symbol, asset_type);

CREATE TABLE IF NOT EXISTS products (
  code TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL UNIQUE REFERENCES assets(id),
  name TEXT NOT NULL,
  product_type TEXT NOT NULL CHECK (product_type IN ('ETF', 'ETN')),
  leverage REAL NOT NULL CHECK (leverage != 0),
  underlying_id TEXT NOT NULL REFERENCES assets(id),
  underlying_type TEXT NOT NULL CHECK (underlying_type IN ('stock', 'spot-index', 'futures-index')),
  listed_date TEXT NOT NULL,
  analysis_capability TEXT NOT NULL CHECK (analysis_capability IN ('full', 'actual-only')),
  active INTEGER NOT NULL CHECK (active IN (0, 1)),
  catalog_scope TEXT NOT NULL CHECK (catalog_scope IN ('production', 'fixture')),
  verification_status TEXT NOT NULL CHECK (verification_status IN ('verified', 'fixture')),
  evidence_url TEXT,
  verified_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS products_scope_active_idx ON products(catalog_scope, active);

CREATE TABLE IF NOT EXISTS prices (
  asset_id TEXT NOT NULL REFERENCES assets(id),
  trade_date TEXT NOT NULL,
  open REAL,
  high REAL,
  low REAL,
  close REAL NOT NULL CHECK (close > 0),
  volume REAL CHECK (volume IS NULL OR volume >= 0),
  source TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  PRIMARY KEY (asset_id, trade_date)
);

CREATE INDEX IF NOT EXISTS prices_trade_date_idx ON prices(trade_date);

CREATE TABLE IF NOT EXISTS sync_runs (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'empty', 'failed')),
  latest_trade_date TEXT,
  record_count INTEGER NOT NULL DEFAULT 0 CHECK (record_count >= 0),
  error_summary TEXT
);

CREATE INDEX IF NOT EXISTS sync_runs_started_at_idx ON sync_runs(started_at DESC);
