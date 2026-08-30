import {
  FixtureMarketDataProvider,
  LiveFscMarketDataProvider,
  PRODUCT_MASTER,
  fixtureCatalog,
  toProduct,
  type DataRange,
  type MarketDataProvider,
  type ProviderProductData,
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

export class IngestionDataError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'IngestionDataError';
  }
}

function assertIngestionSeriesIntegrity(data: ProviderProductData): void {
  const { product, productSeries, underlyingSeries } = data;

  if (productSeries.upstreamTotalCount !== productSeries.prices.length) {
    throw new IngestionDataError('PRODUCT_SERIES_COUNT_MISMATCH');
  }

  if (productSeries.prices.length === 0) {
    if (underlyingSeries !== undefined && underlyingSeries.prices.length > 0) {
      throw new IngestionDataError('ORPHAN_UNDERLYING_SERIES');
    }
    return;
  }

  if (product.analysisCapability !== 'full') return;
  if (underlyingSeries === undefined) {
    throw new IngestionDataError('FULL_UNDERLYING_SERIES_MISSING');
  }
  if (underlyingSeries.prices.length === 0) {
    throw new IngestionDataError('FULL_UNDERLYING_SERIES_EMPTY');
  }
  if (underlyingSeries.upstreamTotalCount !== underlyingSeries.prices.length) {
    throw new IngestionDataError('FULL_UNDERLYING_SERIES_COUNT_MISMATCH');
  }

  const expectedAssetId = `underlying:${product.underlyingId}`;
  if (
    underlyingSeries.asset.id !== expectedAssetId ||
    underlyingSeries.asset.symbol !== product.underlyingId ||
    underlyingSeries.asset.name !== product.underlyingName ||
    underlyingSeries.asset.assetType !== product.underlyingType
  ) {
    throw new IngestionDataError('FULL_UNDERLYING_ASSET_MISMATCH');
  }

  const underlyingDates = new Set(underlyingSeries.prices.map(({ date }) => date));
  if (!productSeries.prices.some(({ date }) => underlyingDates.has(date))) {
    throw new IngestionDataError('FULL_UNDERLYING_DATE_MISMATCH');
  }
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
  let syncRecorded = false;
  try {
    const settled = await Promise.allSettled(
      targets.map(({ product }) =>
        Promise.resolve()
          .then(() => provider.fetchProductData(product, range))
          .then((data) => {
            assertIngestionSeriesIntegrity(data);
            return data;
          }),
      ),
    );
    const results: Array<{
      data: Awaited<ReturnType<MarketDataProvider['fetchProductData']>>;
      metadata: IngestionTarget['metadata'];
      recordCount: number;
    }> = [];
    const failures: unknown[] = [];

    for (const [index, result] of settled.entries()) {
      if (result.status === 'rejected') {
        failures.push(result.reason);
        continue;
      }
      const recordCount =
        result.value.productSeries.prices.length +
        (result.value.underlyingSeries?.prices.length ?? 0);
      results.push({
        data: result.value,
        metadata: targets[index]!.metadata,
        recordCount,
      });
    }

    const recordCount = results.reduce((sum, result) => sum + result.recordCount, 0);
    const latest = latestTradeDate(results.map(({ data }) => data));
    if (results.length > 0) {
      await repository.upsertProductData(
        results.map(({ data, metadata }) => ({ data, metadata })),
        now().toISOString(),
      );
    }

    const emptyTargetCount = results.filter((result) => result.recordCount === 0).length;
    const partial =
      (failures.length > 0 && results.length > 0) || (recordCount > 0 && emptyTargetCount > 0);
    if (failures.length > 0 || partial) {
      const errorSummary = partial
        ? failures.length > 0
          ? `PARTIAL_SYNC_FAILED:${failures.length}/${targets.length}:${safeErrorSummary(failures[0])}`
          : `PARTIAL_SYNC_EMPTY:${emptyTargetCount}/${targets.length}`
        : safeErrorSummary(failures[0]);
      await repository.finishSyncRun(id, {
        finishedAt: now().toISOString(),
        status: 'failed',
        latestTradeDate: latest,
        recordCount,
        errorSummary,
      });
      syncRecorded = true;
      if (failures.length > 0) throw failures[0];
      throw new Error('PARTIAL_SYNC_EMPTY');
    }

    const status = recordCount === 0 ? 'empty' : 'success';
    await repository.finishSyncRun(id, {
      finishedAt: now().toISOString(),
      status,
      latestTradeDate: latest,
      recordCount,
    });
    syncRecorded = true;
    return { id, status, latestTradeDate: latest, recordCount };
  } catch (error) {
    if (!syncRecorded) {
      await repository.finishSyncRun(id, {
        finishedAt: now().toISOString(),
        status: 'failed',
        latestTradeDate: null,
        recordCount: 0,
        errorSummary: safeErrorSummary(error),
      });
    }
    throw error;
  }
}
