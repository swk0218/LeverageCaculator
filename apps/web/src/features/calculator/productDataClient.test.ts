import { describe, expect, it } from 'vitest';

import {
  assertRequestedProductCode,
  createProductDataRequest,
  ProductDataError,
} from './productDataClient';

describe('product data client boundary', () => {
  it('uses a no-cache static JSON request when the Worker API base is empty', () => {
    expect(createProductDataRequest('0198B0', '2026-05-27', '   ')).toEqual({
      url: '/data/analysis/0198B0.json',
      cache: 'no-cache',
    });
  });

  it('keeps the Worker request when an API base URL is configured', () => {
    expect(createProductDataRequest('0198B0', '2026-05-27', ' https://prices.example/ ')).toEqual({
      url: 'https://prices.example/api/v1/analysis-data?productCode=0198B0&from=2026-05-27',
    });
  });

  it('rejects a valid response that belongs to a different selected product', () => {
    expect(() => assertRequestedProductCode('0198B0', '0194N0')).toThrow(ProductDataError);
    expect(() => assertRequestedProductCode('0198B0', '0194N0')).toThrow(
      '선택한 상품과 가격 데이터가 일치하지 않습니다.',
    );
    expect(() => assertRequestedProductCode('0198B0', '0198B0')).not.toThrow();
  });
});
