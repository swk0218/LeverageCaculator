import {
  ProductDataBundleSchema,
  assessStaleness,
  type PricePoint,
  type ProductDataBundle,
} from '@yangbok/contracts';

import { dateInSeoul } from './time';
import type { CachedProductData } from './types';

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

export function buildCachedBundle(cached: CachedProductData, now: Date): ProductDataBundle | null {
  const latestProduct = cached.productSeries.at(-1);
  if (latestProduct === undefined) return null;

  const latestUnderlying = cached.underlyingSeries.at(-1);
  const analysisDate = latestCommonDate(cached.productSeries, cached.underlyingSeries);
  const stale = assessStaleness(latestProduct.date, dateInSeoul(now));
  const warnings: string[] = [];
  if (cached.product.analysisCapability === 'actual-only') {
    warnings.push('검증된 기초자산 시계열이 없어 실제 상품 가격 기준 결과만 제공합니다.');
  }
  if (stale.isStale) warnings.push('공식 가격 기준일이 평일 기준 2일 이상 지연되었습니다.');
  if (latestUnderlying !== undefined && latestUnderlying.date !== latestProduct.date) {
    warnings.push('상품과 기초자산의 최신 기준일이 달라 마지막 공통 거래일로 분석합니다.');
  }

  return ProductDataBundleSchema.parse({
    product: cached.product,
    productSeries: cached.productSeries,
    underlyingSeries: cached.underlyingSeries,
    latest: {
      product: latestProduct,
      ...(latestUnderlying === undefined ? {} : { underlying: latestUnderlying }),
      ...(analysisDate === undefined ? {} : { analysisDate }),
    },
    stale,
    source: 'database',
    fetchedAt: cached.fetchedAt,
    warnings,
  });
}
