import {
  FixtureMarketDataProvider,
  HealthResponseSchema,
  ProductsResponseSchema,
  assessStaleness,
  fixtureCatalog,
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
});
