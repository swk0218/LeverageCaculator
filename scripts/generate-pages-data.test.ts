import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  AnalysisDataResponseSchema,
  PRODUCT_MASTER,
  ProviderProductDataSchema,
  toProduct,
  type DataRange,
  type MarketDataProvider,
  type Product,
  type ProviderProductData,
} from '../packages/contracts/src/index';
import {
  PAGES_UPSTREAM_POLICY,
  StaticDataExportError,
  assertArtifactIsSanitized,
  buildStaticAnalysisResponse,
  dateInSeoul,
  latestEligibleCloseDate,
  runPagesDataExport,
} from './generate-pages-data';

const temporaryRoots: string[] = [];
const VALID_SERVICE_KEY = 'A1b2C3d4E5f6G7h8I9j0K%2BLmN%3D';

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'yangbok-pages-export-test-'));
  temporaryRoots.push(root);
  return root;
}

afterEach(async () => {
  for (const root of temporaryRoots.splice(0)) {
    if (!resolve(root).startsWith(resolve(tmpdir())))
      throw new Error('Unexpected test cleanup path.');
    await rm(root, { recursive: true, force: true });
  }
});

function providerData(
  product: Product,
  prices: ProviderProductData['productSeries']['prices'] = [
    { date: product.listedDate, close: 10_000, open: 9_900, volume: 123 },
    { date: '2026-08-28', close: 10_250, high: 10_300, low: 9_950 },
  ],
): ProviderProductData {
  return ProviderProductDataSchema.parse({
    product,
    productSeries: {
      asset: {
        id: `product:${product.code}`,
        symbol: product.code,
        name: product.name,
        assetType: product.productType,
        source: 'fsc-securities-product',
      },
      prices,
      upstreamTotalCount: prices.length,
    },
  });
}

function mockLiveProvider(
  calls: Array<{ product: Product; range: DataRange }>,
  emptyCode?: string,
): MarketDataProvider {
  return {
    mode: 'live',
    fetchProductData(product, range) {
      calls.push({ product, range });
      return Promise.resolve(providerData(product, product.code === emptyCode ? [] : undefined));
    },
  };
}

describe('GitHub Pages market-data export', () => {
  it('uses a batch-safe upstream timeout without changing the Worker request policy', () => {
    expect(PAGES_UPSTREAM_POLICY).toEqual({
      timeoutMs: 20_000,
      maxRetries: 2,
      retryBaseDelayMs: 1_000,
    });
  });

  it('uses KST dates without treating the generation instant as a trade date', () => {
    const generatedAt = new Date('2026-08-30T15:30:00.000Z');
    const product = toProduct(PRODUCT_MASTER[0]!);
    const response = buildStaticAnalysisResponse(product, providerData(product), generatedAt);

    expect(dateInSeoul(generatedAt)).toBe('2026-08-31');
    expect(response.meta.generatedAt).toBe(generatedAt.toISOString());
    expect(response.data.latest.product.date).toBe('2026-08-28');
    expect(response.data.stale.checkedAt).toBe('2026-08-31');
    expect(response.data.productSeries[0]).toEqual({ date: product.listedDate, close: 10_000 });
    expect(JSON.stringify(response)).not.toContain('fsc-securities-product');
    expect(response.data.source).toBe('static-export');
  });

  it('never makes the current weekday eligible before the 15:40 KST cutoff', () => {
    expect(latestEligibleCloseDate(new Date('2026-08-31T06:39:59.000Z'))).toBe('2026-08-28');
    expect(latestEligibleCloseDate(new Date('2026-08-31T06:40:00.000Z'))).toBe('2026-08-31');
    expect(latestEligibleCloseDate(new Date('2026-08-30T12:00:00.000Z'))).toBe('2026-08-28');
  });

  it('rejects empty series and a provider response for another selected code', () => {
    const generatedAt = new Date('2026-08-30T06:40:00.000Z');
    const expected = toProduct(PRODUCT_MASTER[0]!);
    const other = toProduct(PRODUCT_MASTER[1]!);

    expect(() =>
      buildStaticAnalysisResponse(expected, providerData(expected, []), generatedAt),
    ).toThrow('EMPTY_PRODUCT_SERIES');
    expect(() => buildStaticAnalysisResponse(expected, providerData(other), generatedAt)).toThrow(
      'SELECTED_PRODUCT_CODE_MISMATCH',
    );
  });

  it('rejects raw and encoded service keys plus upstream response metadata', () => {
    const encodedKey = 'sample%2Bservice%2Fkey%3D';
    expect(() => assertArtifactIsSanitized('{"value":"sample+service/key="}', encodedKey)).toThrow(
      'SECRET_FOUND_IN_ARTIFACT',
    );
    expect(() => assertArtifactIsSanitized(`{"value":"${encodedKey}"}`, encodedKey)).toThrow(
      'SECRET_FOUND_IN_ARTIFACT',
    );
    expect(() =>
      assertArtifactIsSanitized('{"url":"https://apis.data.go.kr/example"}', encodedKey),
    ).toThrow('UPSTREAM_METADATA_FOUND_IN_ARTIFACT');
  });

  it('writes exactly all 18 active products and atomically replaces the old directory', async () => {
    const root = await temporaryRoot();
    const outputDir = join(root, 'analysis');
    await mkdir(outputDir);
    await writeFile(join(outputDir, 'old-sentinel.txt'), 'old');

    const calls: Array<{ product: Product; range: DataRange }> = [];
    const factory = vi.fn(() => mockLiveProvider(calls));
    const onProgress = vi.fn();
    const summary = await runPagesDataExport({
      outputDir,
      env: { DATA_GO_KR_SERVICE_KEY: VALID_SERVICE_KEY },
      now: new Date('2026-08-30T06:40:00.000Z'),
      providerFactory: factory,
      onProgress,
    });

    const expectedCodes = PRODUCT_MASTER.filter(({ active }) => active)
      .map(({ code }) => code)
      .sort();
    const files = (await readdir(outputDir)).sort();
    expect(summary).toEqual({ outputDir: resolve(outputDir), productCount: 18 });
    expect(files).toEqual(expectedCodes.map((code) => `${code}.json`));
    expect(factory).toHaveBeenCalledWith(VALID_SERVICE_KEY);
    expect(onProgress).toHaveBeenCalledTimes(18);
    expect(onProgress).toHaveBeenNthCalledWith(1, {
      current: 1,
      total: 18,
      productCode: PRODUCT_MASTER[0]!.code,
    });
    expect(calls).toHaveLength(18);
    expect(calls.map(({ product }) => product.code).sort()).toEqual(expectedCodes);
    for (const { product, range } of calls) {
      expect(range).toEqual({ from: product.listedDate, to: '2026-08-28' });
    }

    for (const code of expectedCodes) {
      const serialized = await readFile(join(outputDir, `${code}.json`), 'utf8');
      expect(AnalysisDataResponseSchema.parse(JSON.parse(serialized)).data.product.code).toBe(code);
      expect(serialized).not.toContain(VALID_SERVICE_KEY);
      expect(serialized).not.toContain('A1b2C3d4E5f6G7h8I9j0K+LmN=');
      expect(serialized).not.toContain('apis.data.go.kr');
    }
  });

  it('accepts a configurable generated-only output directory from the environment', async () => {
    const root = await temporaryRoot();
    const outputDir = join(root, 'custom-analysis');

    const summary = await runPagesDataExport({
      env: {
        DATA_GO_KR_SERVICE_KEY: VALID_SERVICE_KEY,
        PAGES_DATA_OUTPUT_DIR: outputDir,
      },
      now: new Date('2026-08-30T06:40:00.000Z'),
      providerFactory: () => mockLiveProvider([]),
    });

    expect(summary.outputDir).toBe(resolve(outputDir));
    expect(await readdir(outputDir)).toHaveLength(18);
  });

  it('keeps the prior complete directory when any active product is partial', async () => {
    const root = await temporaryRoot();
    const outputDir = join(root, 'analysis');
    await mkdir(outputDir);
    await writeFile(join(outputDir, 'previous.json'), '{"complete":true}\n');
    const calls: Array<{ product: Product; range: DataRange }> = [];

    await expect(
      runPagesDataExport({
        outputDir,
        env: { DATA_GO_KR_SERVICE_KEY: VALID_SERVICE_KEY },
        now: new Date('2026-08-30T06:40:00.000Z'),
        providerFactory: () => mockLiveProvider(calls, PRODUCT_MASTER[2]!.code),
      }),
    ).rejects.toThrow('EMPTY_PRODUCT_SERIES');

    expect(await readdir(outputDir)).toEqual(['previous.json']);
    expect(await readFile(join(outputDir, 'previous.json'), 'utf8')).toBe('{"complete":true}\n');
    expect(await readdir(root)).toEqual(['analysis']);
  });

  it('fails before provider creation or filesystem writes when the env secret is missing', async () => {
    const root = await temporaryRoot();
    const factory = vi.fn(() => mockLiveProvider([]));

    await expect(
      runPagesDataExport({ outputDir: join(root, 'analysis'), env: {}, providerFactory: factory }),
    ).rejects.toEqual(new StaticDataExportError('DATA_GO_KR_SERVICE_KEY_MISSING'));
    expect(factory).not.toHaveBeenCalled();
    expect(await readdir(root)).toEqual([]);
  });

  it('rejects placeholder credentials before provider creation', async () => {
    const root = await temporaryRoot();
    const factory = vi.fn(() => mockLiveProvider([]));

    await expect(
      runPagesDataExport({
        outputDir: join(root, 'analysis'),
        env: { DATA_GO_KR_SERVICE_KEY: 'sample-test-key-placeholder' },
        providerFactory: factory,
      }),
    ).rejects.toThrow('DATA_GO_KR_SERVICE_KEY_INVALID');
    expect(factory).not.toHaveBeenCalled();
    expect(await readdir(root)).toEqual([]);
  });

  it('rejects a broad non-generated output directory before provider calls', async () => {
    const factory = vi.fn(() => mockLiveProvider([]));

    await expect(
      runPagesDataExport({
        outputDir: join(process.cwd(), 'unsafe-static-output'),
        env: { DATA_GO_KR_SERVICE_KEY: VALID_SERVICE_KEY },
        providerFactory: factory,
      }),
    ).rejects.toThrow('UNSAFE_OUTPUT_DIRECTORY');
    expect(factory).not.toHaveBeenCalled();
  });
});
