import {
  FixtureMarketDataProvider,
  LiveFscMarketDataProvider,
  PRODUCT_MASTER,
  fixtureCatalog,
  toProduct,
  type DataRange,
  type MarketDataProvider,
} from '@yangbok/contracts';

import { D1MarketRepository } from './repository';
import type {
  Env,
  IngestionRepository,
  IngestionTarget,
  RuntimeServices,
  SyncOutcome,
} from './types';

function safeInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
}

export function dataMode(env: Env): 'fixture' | 'live' {
  return (env.DATA_MODE ?? env.PUBLIC_DATA_MODE) === 'live' ? 'live' : 'fixture';
}

export function createRuntimeServices(env: Env): RuntimeServices {
  const mode = dataMode(env);
  const repository = new D1MarketRepository(env.DB);
  if (mode === 'fixture') {
    return {
      repository,
      provider: new FixtureMarketDataProvider(),
      targets: fixtureCatalog.map(({ product }) => ({
        product,
        metadata: { scope: 'fixture', verificationStatus: 'fixture' },
      })),
    };
  }

  const provider = new LiveFscMarketDataProvider({
    serviceKey: env.DATA_GO_KR_SERVICE_KEY ?? '',
    timeoutMs: safeInteger(env.UPSTREAM_TIMEOUT_MS, 5_000, 500, 30_000),
    maxRetries: safeInteger(env.UPSTREAM_MAX_RETRIES, 2, 0, 4),
  });
  return {
    repository,
    provider,
    targets: PRODUCT_MASTER.map((entry) => ({
      product: toProduct(entry),
      metadata: {
        scope: 'production',
        verificationStatus: 'verified',
        verifiedAt: entry.verification.verifiedAt,
        evidenceUrl: entry.verification.evidenceUrl,
      },
    })),
  };
}

function latestTradeDate(
  results: readonly Awaited<ReturnType<MarketDataProvider['fetchProductData']>>[],
): string | null {
  const dates = results.flatMap(({ productSeries, underlyingSeries }) => [
    ...productSeries.prices.map(({ date }) => date),
    ...(underlyingSeries?.prices.map(({ date }) => date) ?? []),
  ]);
  return dates.sort().at(-1) ?? null;
}

function safeErrorSummary(error: unknown): string {
  if (error instanceof Error) {
    if ('code' in error && typeof error.code === 'string') return error.code.slice(0, 120);
    return error.name.slice(0, 120);
  }
  return 'UNKNOWN_SYNC_ERROR';
}

export async function runIngestion(
  repository: IngestionRepository,
  provider: MarketDataProvider,
  targets: readonly IngestionTarget[],
  range: DataRange,
  now: () => Date = () => new Date(),
): Promise<SyncOutcome> {
  const id = crypto.randomUUID();
  const startedAt = now().toISOString();
  await repository.startSyncRun(
    id,
    provider.mode === 'live' ? 'data.go.kr-fsc' : 'fixture',
    startedAt,
  );
  try {
    const results = await Promise.all(
      targets.map(({ product }) => provider.fetchProductData(product, range)),
    );
    const recordCount = results.reduce(
      (sum, { productSeries, underlyingSeries }) =>
        sum + productSeries.prices.length + (underlyingSeries?.prices.length ?? 0),
      0,
    );
    const latest = latestTradeDate(results);
    if (recordCount > 0) {
      await repository.upsertProductData(
        results.map((data, index) => ({ data, metadata: targets[index]!.metadata })),
        now().toISOString(),
      );
    }
    const status = recordCount === 0 ? 'empty' : 'success';
    await repository.finishSyncRun(id, {
      finishedAt: now().toISOString(),
      status,
      latestTradeDate: latest,
      recordCount,
    });
    return { id, status, latestTradeDate: latest, recordCount };
  } catch (error) {
    await repository.finishSyncRun(id, {
      finishedAt: now().toISOString(),
      status: 'failed',
      latestTradeDate: null,
      recordCount: 0,
      errorSummary: safeErrorSummary(error),
    });
    throw error;
  }
}
