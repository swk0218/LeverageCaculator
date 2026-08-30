import { withSiteBase } from '../../lib/site-path';

export interface ProductDataRequest {
  url: string;
  cache?: RequestCache;
}

export class ProductDataError extends Error {}

export function createProductDataRequest(
  productCode: string,
  listedDate: string,
  configuredApiBaseUrl: string,
): ProductDataRequest {
  const apiBaseUrl = configuredApiBaseUrl.trim().replace(/\/+$/u, '');
  if (apiBaseUrl) {
    return {
      url: `${apiBaseUrl}/api/v1/analysis-data?productCode=${encodeURIComponent(productCode)}&from=${listedDate}`,
    };
  }

  return {
    url: withSiteBase(`/data/analysis/${encodeURIComponent(productCode)}.json`),
    cache: 'no-cache',
  };
}

export function assertRequestedProductCode(
  requestedProductCode: string,
  responseProductCode: string,
): void {
  if (responseProductCode !== requestedProductCode) {
    throw new ProductDataError(
      '선택한 상품과 가격 데이터가 일치하지 않습니다. 다시 시도해 주세요.',
    );
  }
}
