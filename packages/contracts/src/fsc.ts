import { z } from 'zod';

import type {
  DataRange,
  MarketDataProvider,
  MarketPricePoint,
  ProviderAsset,
  ProviderProductData,
  ProviderSeries,
} from './provider';
import { DataRangeSchema, ProviderProductDataSchema } from './provider';
import { ProductSchema, type Product } from './schemas';

export const FSC_API_SPECS = Object.freeze({
  stock: {
    datasetId: '15094808',
    docsUrl: 'https://www.data.go.kr/data/15094808/openapi.do',
    baseUrl: 'https://apis.data.go.kr/1160100/service/GetStockSecuritiesInfoService',
    operations: { stock: 'getStockPriceInfo' },
  },
  securitiesProduct: {
    datasetId: '15094806',
    docsUrl: 'https://www.data.go.kr/data/15094806/openapi.do',
    baseUrl: 'https://apis.data.go.kr/1160100/service/GetSecuritiesProductInfoService',
    operations: { ETF: 'getETFPriceInfo', ETN: 'getETNPriceInfo' },
  },
  marketIndex: {
    datasetId: '15094807',
    docsUrl: 'https://www.data.go.kr/data/15094807/openapi.do',
    baseUrl: 'https://apis.data.go.kr/1160100/service/GetMarketIndexInfoService',
    operations: { stock: 'getStockMarketIndex', derivatives: 'getDerivationProductMarketIndex' },
  },
});

const numericValue = z
  .union([z.number(), z.string().regex(/^-?(?:\d+\.?\d*|\.\d+)$/)])
  .transform(Number);
const nonnegativeNumericValue = numericValue.pipe(z.number().finite().nonnegative());
const positiveNumericValue = numericValue.pipe(z.number().finite().positive());
const integerValue = numericValue.pipe(z.number().int().nonnegative());
const upstreamDate = z.string().regex(/^\d{8}$/);

const commonPriceFields = {
  basDt: upstreamDate,
  clpr: positiveNumericValue,
  mkp: positiveNumericValue.optional(),
  hipr: positiveNumericValue.optional(),
  lopr: positiveNumericValue.optional(),
  trqu: nonnegativeNumericValue.optional(),
  trPrc: nonnegativeNumericValue.optional(),
  vs: numericValue.optional(),
  fltRt: numericValue.optional(),
};

export const FscStockItemSchema = z
  .object({
    ...commonPriceFields,
    srtnCd: z.string().min(1),
    isinCd: z.string().optional(),
    itmsNm: z.string().min(1),
    mrktCtg: z.string().optional(),
    lstgStCnt: nonnegativeNumericValue.optional(),
    mrktTotAmt: nonnegativeNumericValue.optional(),
  })
  .passthrough();

export const FscEtfItemSchema = z
  .object({
    ...commonPriceFields,
    srtnCd: z.string().min(1),
    isinCd: z.string().optional(),
    itmsNm: z.string().min(1),
    nav: nonnegativeNumericValue.optional(),
    mrktTotAmt: nonnegativeNumericValue.optional(),
    nPptTotAmt: nonnegativeNumericValue.optional(),
    stLstgCnt: nonnegativeNumericValue.optional(),
    bssIdxIdxNm: z.string().optional(),
    bssIdxClpr: nonnegativeNumericValue.optional(),
  })
  .passthrough();

export const FscEtnItemSchema = z
  .object({
    ...commonPriceFields,
    srtnCd: z.string().min(1),
    isinCd: z.string().optional(),
    itmsNm: z.string().min(1),
    indcVal: nonnegativeNumericValue.optional(),
    indcValTotAmt: nonnegativeNumericValue.optional(),
    lstgScrtCnt: nonnegativeNumericValue.optional(),
    mrktTotAmt: nonnegativeNumericValue.optional(),
    bssIdxIdxNm: z.string().optional(),
    bssIdxClpr: nonnegativeNumericValue.optional(),
  })
  .passthrough();

export const FscIndexItemSchema = z
  .object({
    ...commonPriceFields,
    idxNm: z.string().min(1),
    idxCsf: z.string().optional(),
  })
  .passthrough();

const fscHeaderSchema = z.object({ resultCode: z.string(), resultMsg: z.string() }).passthrough();
const fscAuthErrorSchema = z
  .object({
    OpenAPI_ServiceResponse: z.object({
      cmmMsgHeader: z.object({
        errMsg: z.string(),
        returnAuthMsg: z.string().optional(),
        returnReasonCode: z.string().optional(),
      }),
    }),
  })
  .passthrough();

export interface FscPage<T> {
  items: T[];
  numOfRows: number;
  pageNo: number;
  totalCount: number;
}

export class FscProviderError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'FscProviderError';
  }
}

export function parseFscPage<T>(raw: unknown, itemSchema: z.ZodType<T>): FscPage<T> {
  const authError = fscAuthErrorSchema.safeParse(raw);
  if (authError.success) {
    throw new FscProviderError(
      authError.data.OpenAPI_ServiceResponse.cmmMsgHeader.errMsg,
      '공식 데이터 인증에 실패했습니다.',
      false,
    );
  }

  const outer = z
    .union([z.object({ response: z.unknown() }).transform(({ response }) => response), z.unknown()])
    .parse(raw);
  const response = z
    .object({
      header: fscHeaderSchema,
      body: z.unknown().optional(),
    })
    .passthrough()
    .parse(outer);

  if (response.header.resultCode !== '00') {
    throw new FscProviderError(
      response.header.resultCode,
      '공식 데이터 제공처가 오류를 반환했습니다.',
      isRetryableResultCode(response.header.resultCode),
    );
  }

  const body = z
    .object({
      numOfRows: integerValue,
      pageNo: integerValue,
      totalCount: integerValue,
      items: z.unknown().optional(),
    })
    .parse(response.body);

  if (body.totalCount === 0) {
    return { ...body, items: [] };
  }

  const container = z.object({ item: z.unknown() }).safeParse(body.items);
  if (!container.success)
    throw new FscProviderError(
      'MALFORMED_RESPONSE',
      '공식 데이터 응답 형식이 올바르지 않습니다.',
      false,
    );
  const candidates = Array.isArray(container.data.item)
    ? container.data.item
    : [container.data.item];
  const items = z.array(itemSchema).parse(candidates);
  return { ...body, items };
}

function isRetryableResultCode(code: string): boolean {
  return code === '01' || code === '04' || code === '05' || code === '23';
}

function fromUpstreamDate(value: string): string {
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

function toUpstreamDate(value: string): string {
  return value.replaceAll('-', '');
}

function dayAfter(value: string): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

type PriceLike =
  | z.infer<typeof FscStockItemSchema>
  | z.infer<typeof FscEtfItemSchema>
  | z.infer<typeof FscEtnItemSchema>
  | z.infer<typeof FscIndexItemSchema>;

function normalizePrice(item: PriceLike): MarketPricePoint {
  return {
    date: fromUpstreamDate(item.basDt),
    close: item.clpr,
    ...(item.mkp === undefined ? {} : { open: item.mkp }),
    ...(item.hipr === undefined ? {} : { high: item.hipr }),
    ...(item.lopr === undefined ? {} : { low: item.lopr }),
    ...(item.trqu === undefined ? {} : { volume: item.trqu }),
  };
}

function sortAndValidateDates(points: MarketPricePoint[], range: DataRange): MarketPricePoint[] {
  const sorted = [...points].sort((left, right) => left.date.localeCompare(right.date));
  for (let index = 0; index < sorted.length; index += 1) {
    const point = sorted[index];
    if (point !== undefined && (point.date < range.from || point.date > range.to)) {
      throw new FscProviderError(
        'OUT_OF_RANGE_TRADE_DATE',
        '공식 데이터에 요청 범위를 벗어난 거래일이 있습니다.',
        false,
      );
    }
    if (sorted[index]?.date === sorted[index - 1]?.date) {
      throw new FscProviderError(
        'DUPLICATE_TRADE_DATE',
        '공식 데이터에 중복 거래일이 있습니다.',
        false,
      );
    }
  }
  return sorted;
}

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export interface LiveFscProviderOptions {
  serviceKey: string;
  fetch?: FetchLike;
  timeoutMs?: number;
  maxRetries?: number;
  retryBaseDelayMs?: number;
  pageSize?: number;
  sleep?: (milliseconds: number) => Promise<void>;
}

function normalizedServiceKey(serviceKey: string): string {
  const trimmed = serviceKey.trim();
  if (trimmed === '')
    throw new FscProviderError('SERVICE_KEY_MISSING', '공식 데이터 서비스 키가 없습니다.', false);
  if (!trimmed.includes('%')) return trimmed;
  try {
    return decodeURIComponent(trimmed);
  } catch {
    return trimmed;
  }
}

export class LiveFscMarketDataProvider implements MarketDataProvider {
  readonly mode = 'live' as const;
  private readonly serviceKey: string;
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly retryBaseDelayMs: number;
  private readonly pageSize: number;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly underlyingSeriesCache = new Map<string, Promise<ProviderSeries>>();

  constructor(options: LiveFscProviderOptions) {
    this.serviceKey = normalizedServiceKey(options.serviceKey);
    this.fetchImpl = options.fetch ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 5_000;
    this.maxRetries = options.maxRetries ?? 2;
    this.retryBaseDelayMs = options.retryBaseDelayMs ?? 100;
    this.pageSize = options.pageSize ?? 1_000;
    this.sleep =
      options.sleep ??
      ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  }

  async fetchProductData(
    productInput: Product,
    rangeInput: DataRange,
  ): Promise<ProviderProductData> {
    const product = ProductSchema.parse(productInput);
    const range = DataRangeSchema.parse(rangeInput);
    const productSeries = await this.fetchProductSeries(product, range);
    const underlyingSeries =
      product.analysisCapability === 'full' && productSeries.prices.length > 0
        ? await this.fetchCachedUnderlyingSeries(product, range)
        : undefined;
    return ProviderProductDataSchema.parse({
      product,
      productSeries,
      ...(underlyingSeries === undefined ? {} : { underlyingSeries }),
    });
  }

  private underlyingSeriesCacheKey(product: Product, range: DataRange): string {
    return JSON.stringify([
      product.underlyingType,
      product.underlyingId,
      product.underlyingName,
      range.from,
      range.to,
    ]);
  }

  private async fetchCachedUnderlyingSeries(
    product: Product,
    range: DataRange,
  ): Promise<ProviderSeries> {
    const cacheKey = this.underlyingSeriesCacheKey(product, range);
    const cached = this.underlyingSeriesCache.get(cacheKey);
    if (cached !== undefined) return cached;

    const pending = this.fetchUnderlyingSeries(product, range).then((series) => {
      if (
        series.asset.symbol !== product.underlyingId ||
        series.asset.name !== product.underlyingName ||
        series.asset.assetType !== product.underlyingType ||
        series.upstreamTotalCount !== series.prices.length
      ) {
        throw new FscProviderError(
          'UNDERLYING_SERIES_IDENTITY_MISMATCH',
          '공식 기초자산 시계열의 식별 정보가 상품 마스터와 일치하지 않습니다.',
          false,
        );
      }
      if (series.prices.length === 0) {
        throw new FscProviderError(
          'UNDERLYING_SERIES_EMPTY',
          '공식 기초자산 시계열이 비어 있습니다.',
          false,
        );
      }
      return series;
    });
    this.underlyingSeriesCache.set(cacheKey, pending);

    try {
      return await pending;
    } catch (error) {
      if (this.underlyingSeriesCache.get(cacheKey) === pending) {
        this.underlyingSeriesCache.delete(cacheKey);
      }
      throw error;
    }
  }

  private async fetchProductSeries(product: Product, range: DataRange): Promise<ProviderSeries> {
    const operation = FSC_API_SPECS.securitiesProduct.operations[product.productType];
    const schema = product.productType === 'ETF' ? FscEtfItemSchema : FscEtnItemSchema;
    const items = await this.fetchAllPages(
      `${FSC_API_SPECS.securitiesProduct.baseUrl}/${operation}`,
      { likeSrtnCd: product.code },
      range,
      schema,
    );
    const exact = items.filter((item) => item.srtnCd === product.code);
    const asset: ProviderAsset = {
      id: `product:${product.code}`,
      symbol: product.code,
      name: product.name,
      assetType: product.productType,
      source: 'fsc-securities-product',
    };
    return {
      asset,
      prices: sortAndValidateDates(exact.map(normalizePrice), range),
      upstreamTotalCount: exact.length,
    };
  }

  private async fetchUnderlyingSeries(product: Product, range: DataRange): Promise<ProviderSeries> {
    if (product.underlyingType === 'stock') {
      const items = await this.fetchAllPages(
        `${FSC_API_SPECS.stock.baseUrl}/${FSC_API_SPECS.stock.operations.stock}`,
        { likeSrtnCd: product.underlyingId },
        range,
        FscStockItemSchema,
      );
      const exact = items.filter((item) => item.srtnCd === product.underlyingId);
      if (exact.length !== items.length) {
        throw new FscProviderError(
          'UNDERLYING_SERIES_IDENTITY_MISMATCH',
          '공식 기초자산 응답에 다른 종목이 포함되어 있습니다.',
          false,
        );
      }
      return {
        asset: this.underlyingAsset(product, 'fsc-stock'),
        prices: sortAndValidateDates(exact.map(normalizePrice), range),
        upstreamTotalCount: exact.length,
      };
    }

    const operation =
      product.underlyingType === 'spot-index'
        ? FSC_API_SPECS.marketIndex.operations.stock
        : FSC_API_SPECS.marketIndex.operations.derivatives;
    const items = await this.fetchAllPages(
      `${FSC_API_SPECS.marketIndex.baseUrl}/${operation}`,
      { idxNm: product.underlyingName },
      range,
      FscIndexItemSchema,
    );
    const exact = items.filter((item) => item.idxNm === product.underlyingName);
    if (exact.length !== items.length) {
      throw new FscProviderError(
        'UNDERLYING_SERIES_IDENTITY_MISMATCH',
        '공식 기초지수 응답에 다른 지수가 포함되어 있습니다.',
        false,
      );
    }
    return {
      asset: this.underlyingAsset(product, 'fsc-market-index'),
      prices: sortAndValidateDates(exact.map(normalizePrice), range),
      upstreamTotalCount: exact.length,
    };
  }

  private underlyingAsset(
    product: Product,
    source: 'fsc-stock' | 'fsc-market-index',
  ): ProviderAsset {
    return {
      id: `underlying:${product.underlyingId}`,
      symbol: product.underlyingId,
      name: product.underlyingName,
      assetType: product.underlyingType,
      source,
    };
  }

  private async fetchAllPages<T extends PriceLike>(
    endpoint: string,
    filters: Record<string, string>,
    range: DataRange,
    schema: z.ZodType<T>,
  ): Promise<T[]> {
    const items: T[] = [];
    let pageNo = 1;
    let totalCount = 0;
    do {
      const url = new URL(endpoint);
      url.searchParams.set('serviceKey', this.serviceKey);
      url.searchParams.set('resultType', 'json');
      url.searchParams.set('numOfRows', String(this.pageSize));
      url.searchParams.set('pageNo', String(pageNo));
      url.searchParams.set('beginBasDt', toUpstreamDate(range.from));
      url.searchParams.set('endBasDt', toUpstreamDate(dayAfter(range.to)));
      for (const [name, value] of Object.entries(filters)) url.searchParams.set(name, value);
      const page = await this.fetchPage(url, schema);
      items.push(...page.items);
      totalCount = page.totalCount;
      if (page.items.length === 0 && items.length < totalCount) {
        throw new FscProviderError(
          'PAGINATION_STALLED',
          '공식 데이터 페이지가 더 이상 진행되지 않습니다.',
          false,
        );
      }
      pageNo += 1;
    } while (items.length < totalCount && pageNo <= 100);

    if (pageNo > 100 && items.length < totalCount) {
      throw new FscProviderError(
        'PAGINATION_LIMIT',
        '공식 데이터 페이지 제한을 초과했습니다.',
        false,
      );
    }
    return items;
  }

  private async fetchPage<T extends PriceLike>(
    url: URL,
    schema: z.ZodType<T>,
  ): Promise<FscPage<T>> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await this.fetchImpl(url, {
          signal: controller.signal,
          headers: { accept: 'application/json' },
        });
        if (!response.ok) {
          const retryable = response.status === 429 || response.status >= 500;
          throw new FscProviderError(
            `UPSTREAM_HTTP_${response.status}`,
            '공식 데이터 제공처 호출에 실패했습니다.',
            retryable,
          );
        }

        let raw: unknown;
        try {
          raw = await response.json();
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') throw error;
          throw new FscProviderError(
            'MALFORMED_RESPONSE',
            '공식 데이터 응답 형식이 올바르지 않습니다.',
            false,
          );
        }

        try {
          return parseFscPage(raw, schema);
        } catch (error) {
          if (error instanceof FscProviderError) throw error;
          throw new FscProviderError(
            'MALFORMED_RESPONSE',
            '공식 데이터 응답 형식이 올바르지 않습니다.',
            false,
          );
        }
      } catch (error) {
        if (error instanceof FscProviderError && !error.retryable) throw error;
        lastError = error;
        if (attempt === this.maxRetries) break;
      } finally {
        clearTimeout(timeout);
      }
      await this.sleep(this.retryBaseDelayMs * 2 ** attempt);
    }
    if (lastError instanceof FscProviderError) throw lastError;
    throw new FscProviderError(
      lastError instanceof Error && lastError.name === 'AbortError'
        ? 'UPSTREAM_TIMEOUT'
        : 'UPSTREAM_UNAVAILABLE',
      '공식 데이터 제공처에 연결할 수 없습니다.',
      true,
    );
  }
}
