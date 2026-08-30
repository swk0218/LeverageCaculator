import {
  ProductSchema,
  type PricePoint,
  type Product,
  type ProviderProductData,
} from '@yangbok/contracts';

import type {
  CachedProductData,
  CatalogMetadata,
  CatalogScope,
  IngestionRepository,
  LatestProductData,
  RepositoryHealth,
} from './types';

interface ProductRow {
  code: string;
  asset_id: string;
  name: string;
  product_type: 'ETF' | 'ETN';
  leverage: number;
  underlying_id: string;
  underlying_symbol: string;
  underlying_name: string;
  underlying_type: 'stock' | 'spot-index' | 'futures-index';
  analysis_basis: 'underlying-stock' | 'reference-stock-proxy';
  base_index_name: string | null;
  base_index_type: 'price-return-index' | 'futures-index' | 'total-return-index' | null;
  listed_date: string;
  analysis_capability: 'full' | 'actual-only';
  active: number;
}

interface PriceRow {
  trade_date: string;
  close: number;
  fetched_at: string;
}

interface ProductHealthRow {
  code: string;
  latest_trade_date: string | null;
}

interface SyncRunRow {
  status: 'running' | 'success' | 'empty' | 'failed';
  started_at: string;
  finished_at: string | null;
  latest_trade_date: string | null;
  record_count: number;
  error_summary: string | null;
}

function mapProduct(row: ProductRow): Product {
  return ProductSchema.parse({
    code: row.code,
    name: row.name,
    productType: row.product_type,
    leverage: row.leverage,
    underlyingId: row.underlying_symbol,
    underlyingName: row.underlying_name,
    underlyingType: row.underlying_type,
    analysisBasis: row.analysis_basis,
    ...(row.base_index_name === null ? {} : { baseIndexName: row.base_index_name }),
    ...(row.base_index_type === null ? {} : { baseIndexType: row.base_index_type }),
    listedDate: row.listed_date,
    analysisCapability: row.analysis_capability,
    active: row.active === 1,
  });
}

function mapPrices(rows: PriceRow[]): PricePoint[] {
  return rows.map((row) => ({ date: row.trade_date, close: row.close }));
}

const PRODUCT_SELECT = `
  SELECT
    p.code,
    p.asset_id,
    p.name,
    p.product_type,
    p.leverage,
    p.underlying_id,
    u.symbol AS underlying_symbol,
    u.name AS underlying_name,
    p.underlying_type,
    p.analysis_basis,
    p.base_index_name,
    p.base_index_type,
    p.listed_date,
    p.analysis_capability,
    p.active
  FROM products p
  JOIN assets u ON u.id = p.underlying_id
`;

function chunks<T>(values: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size)
    result.push(values.slice(index, index + size));
  return result;
}

export class D1MarketRepository implements IngestionRepository {
  constructor(private readonly db: D1Database) {}

  async health(scope: CatalogScope): Promise<RepositoryHealth> {
    try {
      await this.db.prepare('SELECT 1 AS ok').first();
      const productRows = await this.db
        .prepare(
          `SELECT p.code, MAX(pr.trade_date) AS latest_trade_date
           FROM products p
           LEFT JOIN prices pr ON pr.asset_id = p.asset_id
           WHERE p.catalog_scope = ? AND p.active = 1
           GROUP BY p.code
           ORDER BY p.code`,
        )
        .bind(scope)
        .all<ProductHealthRow>();
      const products = productRows.results.map((row) => ({
        code: row.code,
        latestTradeDate: row.latest_trade_date,
      }));
      const latestTradeDate =
        products
          .flatMap(({ latestTradeDate: date }) => (date === null ? [] : [date]))
          .sort()
          .at(-1) ?? null;
      const source = scope === 'fixture' ? 'fixture' : 'data.go.kr-fsc';
      const lastSyncRow = await this.db
        .prepare(
          `SELECT status, started_at, finished_at, latest_trade_date, record_count, error_summary
           FROM sync_runs
           WHERE source = ?
           ORDER BY started_at DESC
           LIMIT 1`,
        )
        .bind(source)
        .first<SyncRunRow>();
      return {
        database: 'ok',
        latestTradeDate,
        products,
        lastSync:
          lastSyncRow === null
            ? null
            : {
                status: lastSyncRow.status,
                startedAt: lastSyncRow.started_at,
                finishedAt: lastSyncRow.finished_at,
                latestTradeDate: lastSyncRow.latest_trade_date,
                recordCount: lastSyncRow.record_count,
                errorSummary: lastSyncRow.error_summary,
              },
      };
    } catch {
      return {
        database: 'unavailable',
        latestTradeDate: null,
        products: [],
        lastSync: null,
      };
    }
  }

  async listProducts(scope: CatalogScope): Promise<Product[]> {
    const result = await this.db
      .prepare(`${PRODUCT_SELECT} WHERE p.catalog_scope = ? AND p.active = 1 ORDER BY p.code`)
      .bind(scope)
      .all<ProductRow>();
    return result.results.map(mapProduct);
  }

  async getCachedProductData(
    code: string,
    from: string,
    scope: CatalogScope,
  ): Promise<CachedProductData | null> {
    const row = await this.db
      .prepare(
        `${PRODUCT_SELECT} WHERE p.code = ? AND p.catalog_scope = ? AND p.active = 1 LIMIT 1`,
      )
      .bind(code, scope)
      .first<ProductRow>();
    if (row === null) return null;

    const product = mapProduct(row);
    const productRows = await this.priceRows(row.asset_id, from);
    const underlyingRows =
      product.analysisCapability === 'full' ? await this.priceRows(row.underlying_id, from) : [];
    const fetchedAt = productRows.at(-1)?.fetched_at ?? new Date(0).toISOString();
    return {
      product,
      productSeries: mapPrices(productRows),
      underlyingSeries: mapPrices(underlyingRows),
      fetchedAt,
    };
  }

  async getLatestProductData(code: string, scope: CatalogScope): Promise<LatestProductData | null> {
    const row = await this.db
      .prepare(
        `${PRODUCT_SELECT} WHERE p.code = ? AND p.catalog_scope = ? AND p.active = 1 LIMIT 1`,
      )
      .bind(code, scope)
      .first<ProductRow>();
    if (row === null) return null;

    const latest = await this.db
      .prepare(
        `SELECT trade_date, close, fetched_at
         FROM prices
         WHERE asset_id = ?
         ORDER BY trade_date DESC
         LIMIT 1`,
      )
      .bind(row.asset_id)
      .first<PriceRow>();
    if (latest === null) return null;
    return { product: mapProduct(row), latest: { date: latest.trade_date, close: latest.close } };
  }

  async startSyncRun(id: string, source: string, startedAt: string): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO sync_runs (id, source, started_at, status, record_count)
         VALUES (?, ?, ?, 'running', 0)`,
      )
      .bind(id, source, startedAt)
      .run();
  }

  async finishSyncRun(
    id: string,
    result: {
      finishedAt: string;
      status: 'success' | 'empty' | 'failed';
      latestTradeDate: string | null;
      recordCount: number;
      errorSummary?: string;
    },
  ): Promise<void> {
    await this.db
      .prepare(
        `UPDATE sync_runs
         SET finished_at = ?, status = ?, latest_trade_date = ?, record_count = ?, error_summary = ?
         WHERE id = ?`,
      )
      .bind(
        result.finishedAt,
        result.status,
        result.latestTradeDate,
        result.recordCount,
        result.errorSummary ?? null,
        id,
      )
      .run();
  }

  async upsertProductData(
    entries: readonly { data: ProviderProductData; metadata: CatalogMetadata }[],
    fetchedAt: string,
  ): Promise<number> {
    const statements: D1PreparedStatement[] = [];
    let recordCount = 0;
    const queuedAssetIds = new Set<string>();
    const queuedPriceKeys = new Set<string>();

    for (const { data, metadata } of entries) {
      const productAsset = data.productSeries.asset;
      const underlyingAsset = data.underlyingSeries?.asset ?? {
        id: `underlying:${data.product.underlyingId}`,
        symbol: data.product.underlyingId,
        name: data.product.underlyingName,
        assetType: data.product.underlyingType,
        source: metadata.scope === 'fixture' ? 'fixture' : 'product-master-unverified-series',
      };
      for (const asset of [productAsset, underlyingAsset]) {
        if (queuedAssetIds.has(asset.id)) continue;
        queuedAssetIds.add(asset.id);
        statements.push(this.upsertAsset(asset));
      }
      statements.push(
        this.db
          .prepare(
            `INSERT INTO products (
              code, asset_id, name, product_type, leverage, underlying_id, underlying_type,
              analysis_basis, base_index_name, base_index_type, listed_date,
              analysis_capability, active, catalog_scope, verification_status, evidence_url,
              verified_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(code) DO UPDATE SET
              asset_id = excluded.asset_id,
              name = excluded.name,
              product_type = excluded.product_type,
              leverage = excluded.leverage,
              underlying_id = excluded.underlying_id,
              underlying_type = excluded.underlying_type,
              analysis_basis = excluded.analysis_basis,
              base_index_name = excluded.base_index_name,
              base_index_type = excluded.base_index_type,
              listed_date = excluded.listed_date,
              analysis_capability = excluded.analysis_capability,
              active = excluded.active,
              catalog_scope = excluded.catalog_scope,
              verification_status = excluded.verification_status,
              evidence_url = excluded.evidence_url,
              verified_at = excluded.verified_at,
              updated_at = CURRENT_TIMESTAMP`,
          )
          .bind(
            data.product.code,
            productAsset.id,
            data.product.name,
            data.product.productType,
            data.product.leverage,
            underlyingAsset.id,
            data.product.underlyingType,
            data.product.analysisBasis ?? 'underlying-stock',
            data.product.baseIndexName ?? null,
            data.product.baseIndexType ?? null,
            data.product.listedDate,
            data.product.analysisCapability,
            data.product.active ? 1 : 0,
            metadata.scope,
            metadata.verificationStatus,
            metadata.evidenceUrl ?? null,
            metadata.verifiedAt ?? null,
          ),
      );

      const seriesList =
        data.underlyingSeries === undefined
          ? [data.productSeries]
          : [data.productSeries, data.underlyingSeries];
      for (const series of seriesList) {
        for (const point of series.prices) {
          const priceKey = `${series.asset.id}:${point.date}`;
          if (queuedPriceKeys.has(priceKey)) continue;
          queuedPriceKeys.add(priceKey);
          statements.push(
            this.db
              .prepare(
                `INSERT INTO prices (asset_id, trade_date, open, high, low, close, volume, source, fetched_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(asset_id, trade_date) DO UPDATE SET
                   open = excluded.open,
                   high = excluded.high,
                   low = excluded.low,
                   close = excluded.close,
                   volume = excluded.volume,
                   source = excluded.source,
                   fetched_at = excluded.fetched_at`,
              )
              .bind(
                series.asset.id,
                point.date,
                point.open ?? null,
                point.high ?? null,
                point.low ?? null,
                point.close,
                point.volume ?? null,
                series.asset.source,
                fetchedAt,
              ),
          );
          recordCount += 1;
        }
      }
    }

    for (const group of chunks(statements, 90)) await this.db.batch(group);
    return recordCount;
  }

  private async priceRows(assetId: string, from: string): Promise<PriceRow[]> {
    const result = await this.db
      .prepare(
        `SELECT trade_date, close, fetched_at
         FROM prices
         WHERE asset_id = ? AND trade_date >= ?
         ORDER BY trade_date ASC`,
      )
      .bind(assetId, from)
      .all<PriceRow>();
    return result.results;
  }

  private upsertAsset(asset: {
    id: string;
    symbol: string;
    name: string;
    assetType: string;
    source: string;
  }): D1PreparedStatement {
    return this.db
      .prepare(
        `INSERT INTO assets (id, symbol, name, asset_type, source, updated_at)
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(id) DO UPDATE SET
           symbol = excluded.symbol,
           name = excluded.name,
           asset_type = excluded.asset_type,
           source = excluded.source,
           updated_at = CURRENT_TIMESTAMP`,
      )
      .bind(asset.id, asset.symbol, asset.name, asset.assetType, asset.source);
  }
}
