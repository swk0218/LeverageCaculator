import { randomUUID } from 'node:crypto';
import { lstat, mkdir, mkdtemp, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  AnalysisDataResponseSchema,
  ISODateSchema,
  LiveFscMarketDataProvider,
  PRODUCT_MASTER,
  ProviderProductDataSchema,
  assessStaleness,
  toProduct,
  type MarketDataProvider,
  type PricePoint,
  type Product,
  type ProviderProductData,
} from '../packages/contracts/src/index';
import { nodeHttpsFetch } from './node-https-fetch';

export const DEFAULT_PAGES_DATA_OUTPUT_DIR = 'apps/web/public/data/analysis';
export const EXPECTED_ACTIVE_PRODUCT_COUNT = 18;
export const PAGES_UPSTREAM_POLICY = Object.freeze({
  timeoutMs: 20_000,
  maxRetries: 2,
  retryBaseDelayMs: 1_000,
});

type AnalysisDataResponse = ReturnType<typeof AnalysisDataResponseSchema.parse>;

export class StaticDataExportError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'StaticDataExportError';
  }
}

interface ExportEnvironment {
  DATA_GO_KR_SERVICE_KEY?: string;
  PAGES_DATA_OUTPUT_DIR?: string;
}

interface RunPagesDataExportOptions {
  outputDir?: string;
  env?: ExportEnvironment;
  now?: Date;
  providerFactory?: (serviceKey: string) => MarketDataProvider;
  onProgress?: (progress: { current: number; total: number; productCode: string }) => void;
}

interface ExportSummary {
  outputDir: string;
  productCount: number;
}

function isNodeError(error: unknown, code: string): boolean {
  return error instanceof Error && 'code' in error && error.code === code;
}

function isPlausibleServiceKey(serviceKey: string): boolean {
  if (serviceKey.length < 16) return false;
  return ![...decodedValues(serviceKey)].some((value) => {
    const normalized = value.toLowerCase().replaceAll(/[^a-z]/gu, '');
    return ['sample', 'testkey', 'safetest', 'placeholder', 'changeme', 'dummy', 'yourkey'].some(
      (marker) => normalized.includes(marker),
    );
  });
}

function allowedOutputDirectory(outputDirInput: string): string {
  const outputDir = resolve(outputDirInput);
  const defaultOutputDir = resolve(DEFAULT_PAGES_DATA_OUTPUT_DIR);
  const temporaryDirectory = resolve(tmpdir());
  const relativeToTemporaryDirectory = relative(temporaryDirectory, outputDir);
  const isTemporaryDescendant =
    relativeToTemporaryDirectory !== '' &&
    !relativeToTemporaryDirectory.startsWith('..') &&
    !isAbsolute(relativeToTemporaryDirectory);
  if (outputDir !== defaultOutputDir && !isTemporaryDescendant) {
    throw new StaticDataExportError('UNSAFE_OUTPUT_DIRECTORY');
  }
  return outputDir;
}

export function dateInSeoul(instant: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return ISODateSchema.parse(`${values.year}-${values.month}-${values.day}`);
}

function shiftDate(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return ISODateSchema.parse(date.toISOString().slice(0, 10));
}

function weekday(value: string): number {
  return new Date(`${value}T00:00:00.000Z`).getUTCDay();
}

/**
 * Returns the latest weekday whose 15:40 KST collection cutoff has passed.
 *
 * A push or manual workflow can run at any time, so the cron expression alone
 * is not enough to prevent a current trading session from entering an export.
 * Exchange holidays are intentionally left to the provider: an empty holiday
 * contributes no row and the latest real provider basDt remains authoritative.
 */
export function latestEligibleCloseDate(instant: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  let candidate = ISODateSchema.parse(`${values.year}-${values.month}-${values.day}`);
  const hour = Number(values.hour);
  const minute = Number(values.minute);
  const isWeekday = weekday(candidate) >= 1 && weekday(candidate) <= 5;
  const cutoffHasPassed = hour > 15 || (hour === 15 && minute >= 40);

  if (isWeekday && !cutoffHasPassed) candidate = shiftDate(candidate, -1);
  while (weekday(candidate) === 0 || weekday(candidate) === 6) {
    candidate = shiftDate(candidate, -1);
  }
  return candidate;
}

function publicPriceSeries(points: ProviderProductData['productSeries']['prices']): PricePoint[] {
  return points.map(({ date, close }) => ({ date, close }));
}

function latestCommonDate(
  productSeries: readonly PricePoint[],
  underlyingSeries: readonly PricePoint[],
): string | undefined {
  const underlyingDates = new Set(underlyingSeries.map(({ date }) => date));
  return productSeries
    .map(({ date }) => date)
    .filter((date) => underlyingDates.has(date))
    .at(-1);
}

export function buildStaticAnalysisResponse(
  expectedProduct: Product,
  providerData: unknown,
  generatedAt: Date,
): AnalysisDataResponse {
  const parsed = ProviderProductDataSchema.parse(providerData);
  if (
    parsed.product.code !== expectedProduct.code ||
    parsed.productSeries.asset.symbol !== expectedProduct.code
  ) {
    throw new StaticDataExportError('SELECTED_PRODUCT_CODE_MISMATCH');
  }
  if (parsed.productSeries.prices.length === 0) {
    throw new StaticDataExportError('EMPTY_PRODUCT_SERIES');
  }
  if (parsed.productSeries.upstreamTotalCount !== parsed.productSeries.prices.length) {
    throw new StaticDataExportError('FILTERED_PRODUCT_COUNT_MISMATCH');
  }

  const productSeries = publicPriceSeries(parsed.productSeries.prices);
  const underlyingSeries = parsed.underlyingSeries
    ? publicPriceSeries(parsed.underlyingSeries.prices)
    : [];
  const latestProduct = productSeries.at(-1)!;
  const latestUnderlying = underlyingSeries.at(-1);
  const analysisDate = latestCommonDate(productSeries, underlyingSeries);
  const checkedAt = dateInSeoul(generatedAt);
  const stale = assessStaleness(latestProduct.date, checkedAt);
  const warnings: string[] = [];

  if (parsed.product.analysisCapability === 'actual-only') {
    warnings.push('검증된 기초자산 시계열이 없어 실제 상품 가격 기준 결과만 제공합니다.');
  }
  if (stale.isStale) {
    warnings.push('공식 가격 기준일이 평일 기준 2일 이상 지연되었습니다.');
  }
  if (latestUnderlying !== undefined && latestUnderlying.date !== latestProduct.date) {
    warnings.push('상품과 기초자산의 최신 기준일이 달라 마지막 공통 거래일로 분석합니다.');
  }

  return AnalysisDataResponseSchema.parse({
    data: {
      product: parsed.product,
      productSeries,
      underlyingSeries,
      latest: {
        product: latestProduct,
        ...(latestUnderlying === undefined ? {} : { underlying: latestUnderlying }),
        ...(analysisDate === undefined ? {} : { analysisDate }),
      },
      stale,
      source: 'static-export',
      fetchedAt: generatedAt.toISOString(),
      warnings,
    },
    meta: { mode: 'live', generatedAt: generatedAt.toISOString() },
  });
}

function decodedValues(value: string): Set<string> {
  const values = new Set<string>();
  let current = value.trim();
  for (let attempt = 0; attempt < 3 && current !== ''; attempt += 1) {
    values.add(current);
    try {
      const decoded = decodeURIComponent(current);
      if (decoded === current) break;
      current = decoded;
    } catch {
      break;
    }
  }
  return values;
}

export function assertArtifactIsSanitized(serialized: string, serviceKey: string): void {
  const keyRepresentations = decodedValues(serviceKey);
  for (const value of [...keyRepresentations]) {
    keyRepresentations.add(encodeURIComponent(value));
  }
  if ([...keyRepresentations].some((value) => value !== '' && serialized.includes(value))) {
    throw new StaticDataExportError('SECRET_FOUND_IN_ARTIFACT');
  }

  const lowerCaseArtifact = serialized.toLowerCase();
  const forbiddenMarkers = [
    'apis.data.go.kr',
    'www.data.go.kr',
    'openapi_serviceresponse',
    '"resultcode"',
    '"resultmsg"',
    '"servicekey"',
  ];
  if (forbiddenMarkers.some((marker) => lowerCaseArtifact.includes(marker))) {
    throw new StaticDataExportError('UPSTREAM_METADATA_FOUND_IN_ARTIFACT');
  }
}

function assertExactProductSet(
  responses: readonly AnalysisDataResponse[],
  expectedProducts: readonly Product[],
): void {
  const expectedCodes = expectedProducts.map(({ code }) => code).sort();
  const actualCodes = responses.map(({ data }) => data.product.code).sort();
  if (
    expectedCodes.length !== actualCodes.length ||
    new Set(actualCodes).size !== actualCodes.length ||
    expectedCodes.some((code, index) => code !== actualCodes[index])
  ) {
    throw new StaticDataExportError('ACTIVE_PRODUCT_SET_MISMATCH');
  }
}

function assertSafeGeneratedPath(path: string, parent: string, prefix: string): void {
  const resolvedPath = resolve(path);
  if (dirname(resolvedPath) !== parent || !basename(resolvedPath).startsWith(prefix)) {
    throw new StaticDataExportError('UNSAFE_GENERATED_PATH');
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (isNodeError(error, 'ENOENT')) return false;
    throw error;
  }
}

async function assertExistingTargetIsDirectory(outputDir: string): Promise<void> {
  try {
    const entry = await lstat(outputDir);
    if (!entry.isDirectory()) throw new StaticDataExportError('OUTPUT_TARGET_IS_NOT_DIRECTORY');
  } catch (error) {
    if (isNodeError(error, 'ENOENT')) return;
    throw error;
  }
}

async function finalizeDirectory(stageDir: string, outputDir: string): Promise<void> {
  const parent = dirname(outputDir);
  const outputName = basename(outputDir);
  const backupDir = join(parent, `.${outputName}.backup-${randomUUID()}`);
  assertSafeGeneratedPath(stageDir, parent, `.${outputName}.tmp-`);
  assertSafeGeneratedPath(backupDir, parent, `.${outputName}.backup-`);

  let stageExists = true;
  let previousMoved = false;
  let newOutputInstalled = false;
  try {
    if (await pathExists(outputDir)) {
      await rename(outputDir, backupDir);
      previousMoved = true;
    }
    await rename(stageDir, outputDir);
    stageExists = false;
    newOutputInstalled = true;
    if (previousMoved) await rm(backupDir, { recursive: true, force: true });
  } catch (error) {
    if (!newOutputInstalled && previousMoved && !(await pathExists(outputDir))) {
      await rename(backupDir, outputDir);
      previousMoved = false;
    }
    throw error;
  } finally {
    if (stageExists) await rm(stageDir, { recursive: true, force: true });
    if (newOutputInstalled && previousMoved) {
      await rm(backupDir, { recursive: true, force: true });
    }
  }
}

async function writeValidatedResponses(
  outputDirInput: string,
  responses: readonly AnalysisDataResponse[],
  serviceKey: string,
): Promise<string> {
  const outputDir = allowedOutputDirectory(outputDirInput);
  await assertExistingTargetIsDirectory(outputDir);

  const parent = dirname(outputDir);
  const outputName = basename(outputDir);
  await mkdir(parent, { recursive: true });
  const stageDir = await mkdtemp(join(parent, `.${outputName}.tmp-`));
  try {
    for (const response of responses) {
      const serialized = `${JSON.stringify(response, null, 2)}\n`;
      assertArtifactIsSanitized(serialized, serviceKey);
      await writeFile(join(stageDir, `${response.data.product.code}.json`), serialized, {
        encoding: 'utf8',
        flag: 'wx',
      });
    }

    const expectedFiles = responses.map(({ data }) => `${data.product.code}.json`).sort();
    const actualEntries = await readdir(stageDir, { withFileTypes: true });
    const actualFiles = actualEntries
      .filter((entry) => entry.isFile())
      .map(({ name }) => name)
      .sort();
    if (
      actualEntries.length !== actualFiles.length ||
      actualFiles.length !== expectedFiles.length ||
      expectedFiles.some((name, index) => name !== actualFiles[index])
    ) {
      throw new StaticDataExportError('STAGED_FILE_SET_MISMATCH');
    }

    await finalizeDirectory(stageDir, outputDir);
    return outputDir;
  } catch (error) {
    if (await pathExists(stageDir)) await rm(stageDir, { recursive: true, force: true });
    throw error;
  }
}

export async function runPagesDataExport(
  options: RunPagesDataExportOptions = {},
): Promise<ExportSummary> {
  const environment = options.env ?? process.env;
  const serviceKey = environment.DATA_GO_KR_SERVICE_KEY?.trim() ?? '';
  if (serviceKey === '') throw new StaticDataExportError('DATA_GO_KR_SERVICE_KEY_MISSING');
  if (!isPlausibleServiceKey(serviceKey)) {
    throw new StaticDataExportError('DATA_GO_KR_SERVICE_KEY_INVALID');
  }

  const environmentOutputDir = environment.PAGES_DATA_OUTPUT_DIR?.trim();
  const outputDir = allowedOutputDirectory(
    options.outputDir ??
      (environmentOutputDir === undefined || environmentOutputDir === ''
        ? DEFAULT_PAGES_DATA_OUTPUT_DIR
        : environmentOutputDir),
  );

  const products = PRODUCT_MASTER.filter(({ active }) => active).map(toProduct);
  if (
    products.length !== EXPECTED_ACTIVE_PRODUCT_COUNT ||
    new Set(products.map(({ code }) => code)).size !== products.length
  ) {
    throw new StaticDataExportError('ACTIVE_PRODUCT_MASTER_INCOMPLETE');
  }

  const provider =
    options.providerFactory?.(serviceKey) ??
    new LiveFscMarketDataProvider({
      serviceKey,
      ...PAGES_UPSTREAM_POLICY,
      fetch: nodeHttpsFetch,
    });
  if (provider.mode !== 'live') throw new StaticDataExportError('LIVE_PROVIDER_REQUIRED');

  const generatedAt = options.now ?? new Date();
  const to = latestEligibleCloseDate(generatedAt);
  const responses: AnalysisDataResponse[] = [];
  for (const [index, product] of products.entries()) {
    options.onProgress?.({
      current: index + 1,
      total: products.length,
      productCode: product.code,
    });
    const providerData = await provider.fetchProductData(product, {
      from: product.listedDate,
      to,
    });
    responses.push(buildStaticAnalysisResponse(product, providerData, generatedAt));
  }

  assertExactProductSet(responses, products);
  const finalizedOutputDir = await writeValidatedResponses(outputDir, responses, serviceKey);
  return { outputDir: finalizedOutputDir, productCount: responses.length };
}

function parseOutputDirectory(args: readonly string[]): string | undefined {
  const normalizedArgs = args[0] === '--' ? args.slice(1) : args;
  if (normalizedArgs.length === 0) return undefined;
  if (
    normalizedArgs.length === 2 &&
    normalizedArgs[0] === '--output-dir' &&
    normalizedArgs[1]?.trim() !== ''
  ) {
    return normalizedArgs[1];
  }
  const inline =
    normalizedArgs.length === 1 ? normalizedArgs[0]?.match(/^--output-dir=(.+)$/) : undefined;
  if (inline?.[1]?.trim() !== '') return inline?.[1];
  throw new StaticDataExportError('INVALID_COMMAND_ARGUMENTS');
}

function safeFailureCode(error: unknown): string {
  if (error instanceof StaticDataExportError) return error.code;
  if (error instanceof Error && 'code' in error && typeof error.code === 'string') {
    return error.code.slice(0, 120);
  }
  return error instanceof Error ? error.name.slice(0, 120) : 'UNKNOWN_EXPORT_ERROR';
}

const entryPoint = process.argv[1];
const isMain =
  entryPoint !== undefined && pathToFileURL(resolve(entryPoint)).href === import.meta.url;
if (isMain) {
  try {
    const outputDir = parseOutputDirectory(process.argv.slice(2));
    const summary = await runPagesDataExport({
      ...(outputDir === undefined ? {} : { outputDir }),
      env: process.env,
      onProgress: ({ current, total, productCode }) => {
        console.log(`Fetching official market data ${current}/${total}: ${productCode}`);
      },
    });
    console.log(`Generated ${summary.productCount} validated static market-data files.`);
  } catch (error) {
    console.error(`Static market-data export failed: ${safeFailureCode(error)}`);
    process.exitCode = 1;
  }
}
