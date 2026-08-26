import { assessStaleness } from './stale';
import {
  ProductDataBundleSchema,
  ProductSchema,
  type PricePoint,
  type Product,
  type ProductDataBundle,
} from './schemas';
import type {
  DataRange,
  MarketDataProvider,
  ProviderProductData,
  ProviderSeries,
} from './provider';

const FIXTURE_CHECKED_AT = '2026-08-26';
const FIXTURE_FETCHED_AT = '2026-08-26T05:30:00.000Z';

function product(seed: Product): Product {
  return ProductSchema.parse(seed);
}

const up2Product = product({
  code: 'F2UP01',
  name: '[체험용] 반도체 대표주 레버리지 2X',
  productType: 'ETF',
  leverage: 2,
  underlyingId: 'FIXBASEUP',
  underlyingName: '[체험용] 반도체 대표주',
  underlyingType: 'stock',
  listedDate: '2026-08-03',
  analysisCapability: 'full',
  active: true,
});

const inverse2Product = product({
  code: 'F2DN01',
  name: '[체험용] 반도체 대표주 인버스 2X',
  productType: 'ETF',
  leverage: -2,
  underlyingId: 'FIXBASEDN',
  underlyingName: '[체험용] 반도체 대표주',
  underlyingType: 'stock',
  listedDate: '2026-08-03',
  analysisCapability: 'full',
  active: true,
});

const positiveCompoundProduct = product({
  ...up2Product,
  code: 'FPOS01',
  name: '[체험용] 양의 복리효과 경로',
  underlyingId: 'FIXBASEPOS',
  underlyingName: '[체험용] 연속 상승 기초자산',
});

const staleProduct = product({
  ...up2Product,
  code: 'FSTL01',
  name: '[체험용] 오래된 가격 데이터',
});
const mismatchProduct = product({
  ...up2Product,
  code: 'FMIS01',
  name: '[체험용] 기준일 불일치 데이터',
});
const actualOnlyProduct = product({
  ...up2Product,
  code: 'FACT01',
  name: '[체험용] 기초지수 미검증 상품',
  underlyingId: 'UNVERIFIED-FIXTURE-INDEX',
  underlyingName: '[체험용] 미검증 기초지수',
  underlyingType: 'futures-index',
  analysisCapability: 'actual-only',
});

const baseUp: PricePoint[] = [
  { date: '2026-08-17', close: 100 },
  { date: '2026-08-18', close: 102 },
  { date: '2026-08-19', close: 99.96 },
  { date: '2026-08-20', close: 102.9588 },
  { date: '2026-08-21', close: 100.899624 },
  { date: '2026-08-24', close: 102.91761648 },
  { date: '2026-08-25', close: 101.8884403152 },
];

const productUp: PricePoint[] = [
  { date: '2026-08-17', close: 10_000 },
  { date: '2026-08-18', close: 10_400 },
  { date: '2026-08-19', close: 9_984 },
  { date: '2026-08-20', close: 10_583 },
  { date: '2026-08-21', close: 10_160 },
  { date: '2026-08-24', close: 10_566 },
  { date: '2026-08-25', close: 10_355 },
];

const baseDown: PricePoint[] = [
  { date: '2026-08-17', close: 100 },
  { date: '2026-08-18', close: 98 },
  { date: '2026-08-19', close: 99.96 },
  { date: '2026-08-20', close: 96.9612 },
  { date: '2026-08-21', close: 98.900424 },
  { date: '2026-08-24', close: 96.92241552 },
  { date: '2026-08-25', close: 97.8916396752 },
];

const productDown: PricePoint[] = [
  { date: '2026-08-17', close: 10_000 },
  { date: '2026-08-18', close: 10_400 },
  { date: '2026-08-19', close: 9_984 },
  { date: '2026-08-20', close: 10_583 },
  { date: '2026-08-21', close: 10_160 },
  { date: '2026-08-24', close: 10_566 },
  { date: '2026-08-25', close: 10_355 },
];

const basePositiveCompound: PricePoint[] = [
  { date: '2026-08-17', close: 100 },
  { date: '2026-08-18', close: 110 },
  { date: '2026-08-19', close: 121 },
  { date: '2026-08-20', close: 121 },
  { date: '2026-08-21', close: 121 },
  { date: '2026-08-24', close: 121 },
  { date: '2026-08-25', close: 121 },
];

const productPositiveCompound: PricePoint[] = [
  { date: '2026-08-17', close: 10_000 },
  { date: '2026-08-18', close: 12_000 },
  { date: '2026-08-19', close: 14_400 },
  { date: '2026-08-20', close: 14_400 },
  { date: '2026-08-21', close: 14_400 },
  { date: '2026-08-24', close: 14_400 },
  { date: '2026-08-25', close: 14_400 },
];

function latestCommonDate(
  productSeries: PricePoint[],
  underlyingSeries: PricePoint[],
): string | undefined {
  const underlyingDates = new Set(underlyingSeries.map(({ date }) => date));
  return productSeries
    .map(({ date }) => date)
    .filter((date) => underlyingDates.has(date))
    .at(-1);
}

function bundle(
  fixtureProduct: Product,
  productSeries: PricePoint[],
  underlyingSeries: PricePoint[],
): ProductDataBundle {
  const latestProduct = productSeries.at(-1);
  if (latestProduct === undefined) throw new Error('Fixture product series cannot be empty.');
  const latestUnderlying = underlyingSeries.at(-1);
  const analysisDate = latestCommonDate(productSeries, underlyingSeries);
  const warnings: string[] = [];
  if (fixtureProduct.analysisCapability === 'actual-only') {
    warnings.push('기초지수 매핑이 검증되지 않아 실제 손익과 상품 자체 본전만 제공합니다.');
  }
  const stale = assessStaleness(latestProduct.date, FIXTURE_CHECKED_AT);
  if (stale.isStale) warnings.push('공식 가격 기준일이 2영업일 이상 지연되었습니다.');
  if (latestUnderlying !== undefined && latestUnderlying.date !== latestProduct.date) {
    warnings.push('상품과 기초자산의 최신 기준일이 달라 마지막 공통 거래일로 분석합니다.');
  }

  return ProductDataBundleSchema.parse({
    product: fixtureProduct,
    productSeries,
    underlyingSeries,
    latest: {
      product: latestProduct,
      ...(latestUnderlying === undefined ? {} : { underlying: latestUnderlying }),
      ...(analysisDate === undefined ? {} : { analysisDate }),
    },
    stale,
    source: 'fixture',
    fetchedAt: FIXTURE_FETCHED_AT,
    warnings,
  });
}

export const fixtureCatalog: readonly ProductDataBundle[] = Object.freeze([
  bundle(up2Product, productUp, baseUp),
  bundle(inverse2Product, productDown, baseDown),
  bundle(positiveCompoundProduct, productPositiveCompound, basePositiveCompound),
  bundle(staleProduct, productUp.slice(0, 4), baseUp.slice(0, 4)),
  bundle(mismatchProduct, productUp, baseUp.slice(0, 6)),
  bundle(actualOnlyProduct, productUp, []),
]);

export function getFixtureProductData(code: string): ProductDataBundle | undefined {
  const found = fixtureCatalog.find(({ product: { code: fixtureCode } }) => fixtureCode === code);
  return found === undefined ? undefined : ProductDataBundleSchema.parse(found);
}

function filterRange(points: PricePoint[], range: DataRange): PricePoint[] {
  return points.filter(({ date }) => date >= range.from && date <= range.to);
}

function fixtureSeries(
  data: ProductDataBundle,
  kind: 'product' | 'underlying',
  range: DataRange,
): ProviderSeries {
  const isProduct = kind === 'product';
  const prices = filterRange(isProduct ? data.productSeries : data.underlyingSeries, range);
  return {
    asset: isProduct
      ? {
          id: `product:${data.product.code}`,
          symbol: data.product.code,
          name: data.product.name,
          assetType: data.product.productType,
          source: 'fixture',
        }
      : {
          id: `underlying:${data.product.underlyingId}`,
          symbol: data.product.underlyingId,
          name: data.product.underlyingName,
          assetType: data.product.underlyingType,
          source: 'fixture',
        },
    prices,
    upstreamTotalCount: prices.length,
  };
}

export class FixtureMarketDataProvider implements MarketDataProvider {
  readonly mode = 'fixture' as const;

  fetchProductData(productToFetch: Product, range: DataRange): Promise<ProviderProductData> {
    const data = getFixtureProductData(productToFetch.code);
    if (data === undefined) return Promise.reject(new Error('FIXTURE_PRODUCT_NOT_FOUND'));
    const productSeries = fixtureSeries(data, 'product', range);
    const underlyingSeries = fixtureSeries(data, 'underlying', range);
    return Promise.resolve({
      product: data.product,
      productSeries,
      ...(data.product.analysisCapability === 'full' ? { underlyingSeries } : {}),
    });
  }
}

export const SANITIZED_FSC_ETF_PAGE = {
  response: {
    header: { resultCode: '00', resultMsg: 'NORMAL SERVICE.' },
    body: {
      numOfRows: 2,
      pageNo: 1,
      totalCount: 2,
      items: {
        item: [
          {
            basDt: '20260824',
            srtnCd: 'F2UP01',
            isinCd: 'KRXF00000001',
            itmsNm: '[체험용] 반도체 대표주 레버리지 2X',
            clpr: 10_566,
            mkp: 10_420,
            hipr: 10_610,
            lopr: 10_390,
            trqu: 12_345,
            trPrc: 130_000_000,
            vs: 406,
            fltRt: 4,
            nav: 10_552.4,
            bssIdxIdxNm: '[체험용] 반도체 대표주 지수',
            bssIdxClpr: 102.91761648,
          },
          {
            basDt: '20260825',
            srtnCd: 'F2UP01',
            isinCd: 'KRXF00000001',
            itmsNm: '[체험용] 반도체 대표주 레버리지 2X',
            clpr: 10_355,
            mkp: 10_500,
            hipr: 10_520,
            lopr: 10_300,
            trqu: 9_876,
            trPrc: 102_000_000,
            vs: -211,
            fltRt: -2,
            nav: 10_361.8,
            bssIdxIdxNm: '[체험용] 반도체 대표주 지수',
            bssIdxClpr: 101.8884403152,
          },
        ],
      },
    },
  },
} as const;

export const SANITIZED_FSC_STOCK_PAGE = {
  response: {
    header: { resultCode: '00', resultMsg: 'NORMAL SERVICE.' },
    body: {
      numOfRows: 1,
      pageNo: 1,
      totalCount: 1,
      items: {
        item: {
          basDt: '20260825',
          srtnCd: 'FX0001',
          isinCd: 'KRXF00000002',
          itmsNm: '[체험용] 반도체 대표주',
          mrktCtg: 'KOSPI',
          clpr: 101.8884403152,
          mkp: 102.5,
          hipr: 103,
          lopr: 101.5,
          trqu: 1_000_000,
          trPrc: 101_888_440,
          vs: -1.0291761648,
          fltRt: -1,
          lstgStCnt: 5_000_000,
          mrktTotAmt: 509_442_201,
        },
      },
    },
  },
} as const;

export const SANITIZED_FSC_EMPTY_PAGE = {
  response: {
    header: { resultCode: '00', resultMsg: 'NORMAL SERVICE.' },
    body: { numOfRows: 100, pageNo: 1, totalCount: 0, items: { item: [] } },
  },
} as const;

export const SANITIZED_FSC_MALFORMED_PAGE = {
  response: {
    header: { resultCode: '00', resultMsg: 'NORMAL SERVICE.' },
    body: {
      numOfRows: 1,
      pageNo: 1,
      totalCount: 1,
      items: { item: [{ basDt: '20260825', srtnCd: 'F2UP01', itmsNm: '종가 누락' }] },
    },
  },
} as const;

export const SANITIZED_FSC_AUTH_ERROR = {
  OpenAPI_ServiceResponse: {
    cmmMsgHeader: {
      errMsg: 'SERVICE_KEY_IS_NOT_REGISTERED_ERROR',
      returnAuthMsg: '등록되지 않은 서비스키',
      returnReasonCode: '30',
    },
  },
} as const;
