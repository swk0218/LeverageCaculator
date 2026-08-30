import {
  FixtureMarketDataProvider,
  ProductsResponseSchema,
  fixtureCatalog,
  type DataRange,
  type MarketDataProvider,
  type Product,
  type ProviderProductData,
} from '@yangbok/contracts';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../src/app';
import { runIngestion } from '../src/ingestion';
import type {
  CachedProductData,
  CatalogMetadata,
  CatalogScope,
  IngestionRepository,
  LatestProductData,
  RepositoryHealth,
} from '../src/types';

class FixtureRepository implements IngestionRepository {
  readonly finished: Array<{ status: string; recordCount: number; errorSummary?: string }> = [];
  readonly priceKeys = new Set<string>();

  health(scope: CatalogScope): Promise<RepositoryHealth> {
    void scope;
    return Promise.resolve({
      database: 'ok',
      latestTradeDate: '2026-08-25',
      products: fixtureCatalog.map(({ product }) => ({
        code: product.code,
        latestTradeDate: '2026-08-25',
      })),
      lastSync: {
        status: 'success',
        startedAt: '2026-08-26T05:30:00.000Z',
        finishedAt: '2026-08-26T05:30:01.000Z',
        latestTradeDate: '2026-08-25',
        recordCount: 10,
        errorSummary: null,
      },
    });
  }

  listProducts(scope: CatalogScope): Promise<Product[]> {
    void scope;
    return Promise.resolve(fixtureCatalog.map(({ product }) => product));
  }

  getLatestProductData(code: string, scope: CatalogScope): Promise<LatestProductData | null> {
    void scope;
    const fixture = fixtureCatalog.find(({ product }) => product.code === code);
    const latest = fixture?.productSeries.at(-1);
    return Promise.resolve(
      fixture === undefined || latest === undefined ? null : { product: fixture.product, latest },
    );
  }

  getCachedProductData(
    code: string,
    from: string,
    scope: CatalogScope,
  ): Promise<CachedProductData | null> {
    void scope;
    const fixture = fixtureCatalog.find(({ product }) => product.code === code);
    if (fixture === undefined) return Promise.resolve(null);
    return Promise.resolve({
      product: fixture.product,
      productSeries: fixture.productSeries.filter(({ date }) => date >= from),
      underlyingSeries: fixture.underlyingSeries.filter(({ date }) => date >= from),
      fetchedAt: fixture.fetchedAt,
    });
  }

  startSyncRun(id: string, source: string, startedAt: string): Promise<void> {
    void id;
    void source;
    void startedAt;
    return Promise.resolve();
  }

  finishSyncRun(
    id: string,
    result: {
      finishedAt: string;
      status: 'success' | 'empty' | 'failed';
      latestTradeDate: string | null;
      recordCount: number;
      errorSummary?: string;
    },
  ): Promise<void> {
    void id;
    void result.finishedAt;
    void result.latestTradeDate;
    this.finished.push({
      status: result.status,
      recordCount: result.recordCount,
      ...(result.errorSummary === undefined ? {} : { errorSummary: result.errorSummary }),
    });
    return Promise.resolve();
  }

  upsertProductData(
    entries: readonly { data: ProviderProductData; metadata: CatalogMetadata }[],
    fetchedAt: string,
  ): Promise<number> {
    void fetchedAt;
    let count = 0;
    for (const { data, metadata } of entries) {
      void metadata;
      for (const series of [data.productSeries, data.underlyingSeries]) {
        if (series === undefined) continue;
        for (const point of series.prices) {
          this.priceKeys.add(`${series.asset.id}:${point.date}`);
          count += 1;
        }
      }
    }
    return Promise.resolve(count);
  }
}

function fixtureApp(repository = new FixtureRepository()) {
  const runBackfill = vi.fn((range: DataRange) => {
    void range;
    return Promise.resolve({
      id: 'sync-1',
      status: 'success' as const,
      latestTradeDate: '2026-08-25',
      recordCount: 1,
    });
  });
  const app = createApp({
    repository,
    mode: 'fixture',
    allowedOrigins: new Set(['https://yangbok.example']),
    now: () => new Date('2026-08-26T06:00:00.000Z'),
    backfillToken: 'this-is-a-long-test-token',
    runBackfill,
  });
  return { app, repository, runBackfill };
}

describe('Worker HTTP contract', () => {
  it('serves validated product, latest and analysis data with freshness metadata', async () => {
    const { app } = fixtureApp();
    const products = await app.fetch(new Request('https://api.example/api/v1/products'));
    expect(products.status).toBe(200);
    expect(ProductsResponseSchema.parse(await products.json()).data).toHaveLength(
      fixtureCatalog.length,
    );

    const latest = await app.fetch(
      new Request('https://api.example/api/v1/products/F2UP01/latest'),
    );
    expect(await latest.json()).toMatchObject({
      data: { latest: { date: '2026-08-25' }, stale: { isStale: false } },
    });

    const analysis = await app.fetch(
      new Request('https://api.example/api/v1/analysis-data?productCode=FMIS01&from=2026-08-17'),
    );
    expect(analysis.headers.get('cache-control')).toContain('stale-while-revalidate');
    expect(await analysis.json()).toMatchObject({
      data: { source: 'database', latest: { analysisDate: '2026-08-24' } },
      meta: { mode: 'fixture' },
    });
  });

  it('reports health and stale state without claiming a stale cache is healthy', async () => {
    const repository = new FixtureRepository();
    repository.health = () =>
      Promise.resolve({
        database: 'ok',
        latestTradeDate: '2026-08-25',
        products: [
          { code: 'F2UP01', latestTradeDate: '2026-08-25' },
          { code: 'F2DN01', latestTradeDate: '2026-08-20' },
          { code: 'FMIS01', latestTradeDate: null },
        ],
        lastSync: {
          status: 'success',
          startedAt: '2026-08-26T05:30:00.000Z',
          finishedAt: '2026-08-26T05:30:01.000Z',
          latestTradeDate: '2026-08-25',
          recordCount: 10,
          errorSummary: null,
        },
      });
    const { app } = fixtureApp(repository);
    const response = await app.fetch(new Request('https://api.example/api/v1/health'));
    expect(await response.json()).toMatchObject({
      status: 'degraded',
      latestTradeDate: '2026-08-25',
      stale: true,
      coverage: {
        activeProducts: 3,
        freshProducts: 1,
        staleProducts: 1,
        missingProducts: 1,
        complete: false,
      },
      lastSync: { state: 'success' },
    });
  });

  it('fails health closed when the latest sync failed even if every product is fresh', async () => {
    const repository = new FixtureRepository();
    repository.health = () =>
      Promise.resolve({
        database: 'ok',
        latestTradeDate: '2026-08-25',
        products: fixtureCatalog.map(({ product }) => ({
          code: product.code,
          latestTradeDate: '2026-08-25',
        })),
        lastSync: {
          status: 'failed',
          startedAt: '2026-08-26T05:30:00.000Z',
          finishedAt: '2026-08-26T05:30:01.000Z',
          latestTradeDate: '2026-08-25',
          recordCount: 4,
          errorSummary: 'PARTIAL_SYNC_FAILED:1/3:Error',
        },
      });
    const { app } = fixtureApp(repository);
    const response = await app.fetch(new Request('https://api.example/api/v1/health'));
    expect(await response.json()).toMatchObject({
      status: 'degraded',
      stale: false,
      coverage: { complete: true },
      lastSync: { state: 'partial', recordCount: 4 },
    });
  });

  it('limits CORS and rejects extra query fields so financial inputs are never accepted', async () => {
    const { app } = fixtureApp();
    const denied = await app.fetch(
      new Request('https://api.example/api/v1/products', {
        headers: { origin: 'https://attacker.example' },
      }),
    );
    expect(denied.status).toBe(403);
    expect(denied.headers.has('access-control-allow-origin')).toBe(false);

    const allowed = await app.fetch(
      new Request('https://api.example/api/v1/products', {
        headers: { origin: 'https://yangbok.example' },
      }),
    );
    expect(allowed.headers.get('access-control-allow-origin')).toBe('https://yangbok.example');

    const privateInput = await app.fetch(
      new Request(
        'https://api.example/api/v1/analysis-data?productCode=F2UP01&from=2026-08-17&purchasePrice=10000',
      ),
    );
    expect(privateInput.status).toBe(400);
    expect(JSON.stringify(await privateInput.json())).not.toContain('10000');
  });

  it('protects backfill and accepts only a bounded date query with no body', async () => {
    const { app, runBackfill } = fixtureApp();
    const denied = await app.fetch(
      new Request('https://api.example/api/v1/admin/backfill?from=2026-08-01&to=2026-08-25', {
        method: 'POST',
      }),
    );
    expect(denied.status).toBe(401);

    const accepted = await app.fetch(
      new Request('https://api.example/api/v1/admin/backfill?from=2026-08-01&to=2026-08-25', {
        method: 'POST',
        headers: { authorization: 'Bearer this-is-a-long-test-token' },
      }),
    );
    expect(accepted.status).toBe(202);
    expect(runBackfill).toHaveBeenCalledWith({ from: '2026-08-01', to: '2026-08-25' });
  });

  it('rejects every backfill request body even without Content-Length', async () => {
    const { app, runBackfill } = fixtureApp();
    const url = 'https://api.example/api/v1/admin/backfill?from=2026-08-01&to=2026-08-25';
    const headers = { authorization: 'Bearer this-is-a-long-test-token' };

    const stringRequest = new Request(url, { method: 'POST', headers, body: '{}' });
    expect(stringRequest.headers.get('content-length')).toBeNull();
    const stringResponse = await app.fetch(stringRequest);
    expect(stringResponse.status).toBe(400);
    expect(await stringResponse.json()).toMatchObject({ error: { code: 'BODY_NOT_ALLOWED' } });

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"chunked":true}'));
        controller.close();
      },
    });
    const streamRequest = new Request(url, {
      method: 'POST',
      headers,
      body: stream,
      duplex: 'half',
    } as RequestInit & { duplex: 'half' });
    expect(streamRequest.headers.get('content-length')).toBeNull();
    const streamResponse = await app.fetch(streamRequest);
    expect(streamResponse.status).toBe(400);
    expect(await streamResponse.json()).toMatchObject({ error: { code: 'BODY_NOT_ALLOWED' } });
    expect(runBackfill).not.toHaveBeenCalled();
  });
});

describe('scheduled ingestion', () => {
  it('upserts fixture data idempotently on repeated runs', async () => {
    const repository = new FixtureRepository();
    const provider = new FixtureMarketDataProvider();
    const targets = fixtureCatalog.map(({ product }) => ({
      product,
      metadata: { scope: 'fixture' as const, verificationStatus: 'fixture' as const },
    }));
    const now = () => new Date('2026-08-26T05:30:00.000Z');
    const range = { from: '2026-08-17' as const, to: '2026-08-25' as const };
    await runIngestion(repository, provider, targets, range, now);
    const firstSize = repository.priceKeys.size;
    await runIngestion(repository, provider, targets, range, now);
    expect(repository.priceKeys.size).toBe(firstSize);
    expect(repository.finished.map(({ status }) => status)).toEqual(['success', 'success']);
  });

  it('preserves stored rows when the upstream returns an empty range', async () => {
    const repository = new FixtureRepository();
    repository.priceKeys.add('existing:2026-08-25');
    await runIngestion(
      repository,
      new FixtureMarketDataProvider(),
      [
        {
          product: fixtureCatalog[0]!.product,
          metadata: { scope: 'fixture', verificationStatus: 'fixture' },
        },
      ],
      { from: '2026-08-26', to: '2026-08-26' },
      () => new Date('2026-08-26T05:30:00.000Z'),
    );
    expect(repository.priceKeys).toEqual(new Set(['existing:2026-08-25']));
    expect(repository.finished.at(-1)).toMatchObject({ status: 'empty', recordCount: 0 });
  });

  it.each<{
    label: string;
    errorCode: string;
    corrupt: (data: ProviderProductData) => ProviderProductData;
  }>([
    {
      label: 'missing',
      errorCode: 'FULL_UNDERLYING_SERIES_MISSING',
      corrupt(data) {
        const { underlyingSeries: ignored, ...withoutUnderlying } = data;
        void ignored;
        return withoutUnderlying;
      },
    },
    {
      label: 'empty',
      errorCode: 'FULL_UNDERLYING_SERIES_EMPTY',
      corrupt(data) {
        return {
          ...data,
          underlyingSeries: {
            ...data.underlyingSeries!,
            prices: [],
            upstreamTotalCount: 0,
          },
        };
      },
    },
    {
      label: 'wrong asset',
      errorCode: 'FULL_UNDERLYING_ASSET_MISMATCH',
      corrupt(data) {
        return {
          ...data,
          underlyingSeries: {
            ...data.underlyingSeries!,
            asset: { ...data.underlyingSeries!.asset, symbol: 'WRONG1' },
          },
        };
      },
    },
    {
      label: 'non-overlapping dates',
      errorCode: 'FULL_UNDERLYING_DATE_MISMATCH',
      corrupt(data) {
        return {
          ...data,
          underlyingSeries: {
            ...data.underlyingSeries!,
            prices: [{ date: '2026-08-16', close: 100 }],
            upstreamTotalCount: 1,
          },
        };
      },
    },
  ])('rejects a $label underlying series for a full product', async ({ errorCode, corrupt }) => {
    const repository = new FixtureRepository();
    repository.priceKeys.add('existing:2026-08-25');
    const fixtureProvider = new FixtureMarketDataProvider();
    const target = fixtureCatalog[0]!.product;
    const provider: MarketDataProvider = {
      mode: 'live',
      async fetchProductData(product, range) {
        return corrupt(await fixtureProvider.fetchProductData(product, range));
      },
    };

    await expect(
      runIngestion(
        repository,
        provider,
        [
          {
            product: target,
            metadata: { scope: 'fixture', verificationStatus: 'fixture' },
          },
        ],
        { from: '2026-08-17', to: '2026-08-25' },
        () => new Date('2026-08-26T05:30:00.000Z'),
      ),
    ).rejects.toThrow(errorCode);
    expect(repository.priceKeys).toEqual(new Set(['existing:2026-08-25']));
    expect(repository.finished.at(-1)).toEqual({
      status: 'failed',
      recordCount: 0,
      errorSummary: errorCode,
    });
  });

  it('preserves stored rows and sanitizes the sync record when a provider fails', async () => {
    const repository = new FixtureRepository();
    repository.priceKeys.add('existing:2026-08-25');
    const provider: MarketDataProvider = {
      mode: 'live',
      fetchProductData: () => Promise.reject(new Error('secret upstream response body')),
    };
    await expect(
      runIngestion(
        repository,
        provider,
        [
          {
            product: fixtureCatalog[0]!.product,
            metadata: { scope: 'fixture', verificationStatus: 'fixture' },
          },
        ],
        { from: '2026-08-17', to: '2026-08-25' },
        () => new Date('2026-08-26T05:30:00.000Z'),
      ),
    ).rejects.toThrow('secret upstream response body');
    expect(repository.priceKeys).toEqual(new Set(['existing:2026-08-25']));
    expect(repository.finished.at(-1)).toEqual({
      status: 'failed',
      recordCount: 0,
      errorSummary: 'Error',
    });
  });

  it('persists successful targets but records and throws a partial sync when another target fails', async () => {
    const repository = new FixtureRepository();
    const fixtureProvider = new FixtureMarketDataProvider();
    const failedCode = fixtureCatalog[1]!.product.code;
    const provider: MarketDataProvider = {
      mode: 'live',
      fetchProductData: (product, range) =>
        product.code === failedCode
          ? Promise.reject(new Error('secret partial failure'))
          : fixtureProvider.fetchProductData(product, range),
    };
    const targets = fixtureCatalog.slice(0, 2).map(({ product }) => ({
      product,
      metadata: { scope: 'fixture' as const, verificationStatus: 'fixture' as const },
    }));

    await expect(
      runIngestion(
        repository,
        provider,
        targets,
        { from: '2026-08-17', to: '2026-08-25' },
        () => new Date('2026-08-26T05:30:00.000Z'),
      ),
    ).rejects.toThrow('secret partial failure');
    expect(repository.priceKeys.size).toBeGreaterThan(0);
    expect(repository.finished.at(-1)).toMatchObject({
      status: 'failed',
      errorSummary: 'PARTIAL_SYNC_FAILED:1/2:Error',
    });
    expect(repository.finished.at(-1)?.recordCount).toBeGreaterThan(0);
  });

  it('does not report success when only some targets return rows', async () => {
    const repository = new FixtureRepository();
    const fixtureProvider = new FixtureMarketDataProvider();
    const emptyCode = fixtureCatalog[1]!.product.code;
    const provider: MarketDataProvider = {
      mode: 'fixture',
      async fetchProductData(product, range) {
        const data = await fixtureProvider.fetchProductData(product, range);
        if (product.code !== emptyCode) return data;
        return {
          ...data,
          productSeries: { ...data.productSeries, prices: [], upstreamTotalCount: 0 },
          ...(data.underlyingSeries === undefined
            ? {}
            : {
                underlyingSeries: {
                  ...data.underlyingSeries,
                  prices: [],
                  upstreamTotalCount: 0,
                },
              }),
        };
      },
    };
    const targets = fixtureCatalog.slice(0, 2).map(({ product }) => ({
      product,
      metadata: { scope: 'fixture' as const, verificationStatus: 'fixture' as const },
    }));

    await expect(
      runIngestion(
        repository,
        provider,
        targets,
        { from: '2026-08-17', to: '2026-08-25' },
        () => new Date('2026-08-26T05:30:00.000Z'),
      ),
    ).rejects.toThrow('PARTIAL_SYNC_EMPTY');
    expect(repository.finished.at(-1)).toMatchObject({
      status: 'failed',
      errorSummary: 'PARTIAL_SYNC_EMPTY:1/2',
    });
  });
});
