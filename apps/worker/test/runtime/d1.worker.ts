import {
  FixtureMarketDataProvider,
  HealthResponseSchema,
  PRODUCT_MASTER,
  ProductsResponseSchema,
  assessStaleness,
  fixtureCatalog,
  toProduct,
  type ProviderProductData,
} from '@yangbok/contracts';
import { applyD1Migrations, env, SELF } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';

import { runIngestion } from '../../src/ingestion';
import { D1MarketRepository } from '../../src/repository';
import { dateInSeoul } from '../../src/time';

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

describe('D1 Worker integration', () => {
  it('persists fixture data idempotently and serves it through the public contract', async () => {
    const repository = new D1MarketRepository(env.DB);
    const provider = new FixtureMarketDataProvider();
    const targets = fixtureCatalog.map(({ product }) => ({
      product,
      metadata: { scope: 'fixture' as const, verificationStatus: 'fixture' as const },
    }));
    const now = () => new Date('2026-08-26T05:30:00.000Z');
    const range = { from: '2026-08-17' as const, to: '2026-08-25' as const };

    await runIngestion(repository, provider, targets, range, now);
    const first = await env.DB.prepare('SELECT COUNT(*) AS count FROM prices').first<{
      count: number;
    }>();
    await runIngestion(repository, provider, targets, range, now);
    const second = await env.DB.prepare('SELECT COUNT(*) AS count FROM prices').first<{
      count: number;
    }>();
    expect(second?.count).toBe(first?.count);

    const products = await SELF.fetch('https://worker.example/api/v1/products');
    expect(products.status).toBe(200);
    expect(ProductsResponseSchema.parse(await products.json()).data).toHaveLength(
      fixtureCatalog.length,
    );

    const analysis = await SELF.fetch(
      'https://worker.example/api/v1/analysis-data?productCode=F2UP01&from=2026-08-17',
    );
    expect(analysis.status).toBe(200);
    expect(await analysis.json()).toMatchObject({
      data: { product: { code: 'F2UP01' }, source: 'database' },
    });

    const health = await SELF.fetch('https://worker.example/api/v1/health');
    expect(health.status).toBe(200);
    const healthPayload = HealthResponseSchema.parse(await health.json());
    const checkedDate = dateInSeoul(new Date(healthPayload.checkedAt));
    const expectedStaleProducts = fixtureCatalog.filter(
      ({ latest }) => assessStaleness(latest.product.date, checkedDate).isStale,
    ).length;
    expect(healthPayload).toMatchObject({
      status: 'degraded',
      stale: true,
      coverage: {
        activeProducts: fixtureCatalog.length,
        freshProducts: fixtureCatalog.length - expectedStaleProducts,
        staleProducts: expectedStaleProducts,
        missingProducts: 0,
        complete: false,
      },
      lastSync: { state: 'success' },
    });
  });

  it('persists analysis basis and writes a shared stock series only once per batch', async () => {
    const repository = new D1MarketRepository(env.DB);
    const entries = ['0198B0', '0193W0', '520100'].map((code) => {
      const master = PRODUCT_MASTER.find((entry) => entry.code === code)!;
      const product = toProduct(master);
      const underlyingSeries: NonNullable<ProviderProductData['underlyingSeries']> = {
        asset: {
          id: 'underlying:005930',
          symbol: '005930',
          name: '삼성전자',
          assetType: 'stock',
          source: 'fsc-stock',
        },
        prices: [
          { date: '2026-08-27', close: 72_000 },
          { date: '2026-08-28', close: 73_000 },
        ],
        upstreamTotalCount: 2,
      };
      return {
        data: {
          product,
          productSeries: {
            asset: {
              id: `product:${product.code}`,
              symbol: product.code,
              name: product.name,
              assetType: product.productType,
              source: 'fsc-securities-product' as const,
            },
            prices: [
              { date: '2026-08-27' as const, close: 10_000 },
              { date: '2026-08-28' as const, close: 10_100 },
            ],
            upstreamTotalCount: 2,
          },
          underlyingSeries,
        },
        metadata: {
          scope: 'production' as const,
          verificationStatus: 'verified' as const,
          evidenceUrl: master.verification.evidenceUrl,
          verifiedAt: master.verification.verifiedAt,
        },
      };
    });

    const recordCount = await repository.upsertProductData(entries, '2026-08-28T06:40:00.000Z');
    expect(recordCount).toBe(8);

    const sharedPrices = await env.DB.prepare(
      "SELECT trade_date FROM prices WHERE asset_id = 'underlying:005930' ORDER BY trade_date",
    ).all<{ trade_date: string }>();
    expect(sharedPrices.results.map(({ trade_date }) => trade_date)).toEqual([
      '2026-08-27',
      '2026-08-28',
    ]);

    const products = await repository.listProducts('production');
    expect(products).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: '0198B0',
          underlyingId: '005930',
          underlyingType: 'stock',
          analysisCapability: 'full',
          analysisBasis: 'reference-stock-proxy',
          baseIndexName: 'KRX 삼성전자 선물 지수',
          baseIndexType: 'futures-index',
        }),
        expect.objectContaining({
          code: '0193W0',
          underlyingId: '005930',
          underlyingType: 'stock',
          analysisCapability: 'full',
          analysisBasis: 'underlying-stock',
          baseIndexName: 'KRX 삼성전자 지수(PR)',
          baseIndexType: 'price-return-index',
        }),
        expect.objectContaining({
          code: '520100',
          underlyingId: '005930',
          underlyingType: 'stock',
          analysisCapability: 'full',
          analysisBasis: 'reference-stock-proxy',
          baseIndexName: 'KRX 삼성전자 TR 지수',
          baseIndexType: 'total-return-index',
        }),
      ]),
    );
  });
});
