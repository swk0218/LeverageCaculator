ALTER TABLE products
ADD COLUMN analysis_basis TEXT NOT NULL DEFAULT 'underlying-stock'
CHECK (analysis_basis IN ('underlying-stock', 'reference-stock-proxy'));

ALTER TABLE products
ADD COLUMN base_index_name TEXT;

ALTER TABLE products
ADD COLUMN base_index_type TEXT
CHECK (
  base_index_type IS NULL OR
  base_index_type IN ('price-return-index', 'futures-index', 'total-return-index')
);

INSERT INTO assets (id, symbol, name, asset_type, source) VALUES
  ('underlying:005930', '005930', '삼성전자', 'stock', 'fsc-stock'),
  ('underlying:000660', '000660', 'SK하이닉스', 'stock', 'fsc-stock')
ON CONFLICT(id) DO UPDATE SET
  symbol = excluded.symbol,
  name = excluded.name,
  asset_type = excluded.asset_type,
  source = excluded.source,
  updated_at = CURRENT_TIMESTAMP;

UPDATE products
SET
  underlying_id = 'underlying:005930',
  underlying_type = 'stock',
  analysis_capability = 'full',
  analysis_basis = CASE
    WHEN code IN ('0198B0', '0194N0', '520100', '0193L0') THEN 'reference-stock-proxy'
    ELSE 'underlying-stock'
  END,
  base_index_name = CASE
    WHEN code = '520100' THEN 'KRX 삼성전자 TR 지수'
    WHEN code IN ('0198B0', '0194N0', '0193L0') THEN 'KRX 삼성전자 선물 지수'
    ELSE 'KRX 삼성전자 지수(PR)'
  END,
  base_index_type = CASE
    WHEN code = '520100' THEN 'total-return-index'
    WHEN code IN ('0198B0', '0194N0', '0193L0') THEN 'futures-index'
    ELSE 'price-return-index'
  END,
  updated_at = CURRENT_TIMESTAMP
WHERE catalog_scope = 'production'
  AND code IN (
    '0198B0', '0194N0', '0193W0', '0195R0', '0194M0', '0192M0', '0193K0', '520100',
    '0193L0'
  );

UPDATE products
SET
  underlying_id = 'underlying:000660',
  underlying_type = 'stock',
  analysis_capability = 'full',
  analysis_basis = CASE
    WHEN code IN ('0194R0', '0198D0', '520101', '0197X0') THEN 'reference-stock-proxy'
    ELSE 'underlying-stock'
  END,
  base_index_name = CASE
    WHEN code = '520101' THEN 'KRX SK하이닉스 TR 지수'
    WHEN code IN ('0194R0', '0198D0', '0197X0') THEN 'KRX SK하이닉스 선물 지수'
    ELSE 'KRX SK하이닉스 지수(PR)'
  END,
  base_index_type = CASE
    WHEN code = '520101' THEN 'total-return-index'
    WHEN code IN ('0194R0', '0198D0', '0197X0') THEN 'futures-index'
    ELSE 'price-return-index'
  END,
  updated_at = CURRENT_TIMESTAMP
WHERE catalog_scope = 'production'
  AND code IN (
    '0194R0', '0198D0', '0193T0', '0195S0', '0197W0', '0194T0', '0192L0', '520101',
    '0197X0'
  );
