import { describe, expect, it } from 'vitest';

import {
  PAGES_STATIC_PRODUCT_EXPECTATIONS,
  validatePagesStaticProductExport,
} from './release-check.mjs';

function validPayload() {
  return {
    meta: { mode: 'live', generatedAt: '2026-08-31T06:40:00.000Z' },
    data: {
      source: 'static-export',
      product: {
        code: '0198B0',
        analysisCapability: 'full',
        underlyingId: '005930',
        underlyingType: 'stock',
        analysisBasis: 'reference-stock-proxy',
        baseIndexName: 'KRX 삼성전자 선물 지수',
        baseIndexType: 'futures-index',
      },
      productSeries: [
        { date: '2026-08-27', close: 10_000 },
        { date: '2026-08-28', close: 10_250 },
      ],
      underlyingSeries: [
        { date: '2026-08-26', close: 69_500 },
        { date: '2026-08-27', close: 70_000 },
      ],
      latest: {
        product: { date: '2026-08-28', close: 10_250 },
        underlying: { date: '2026-08-27', close: 70_000 },
        analysisDate: '2026-08-27',
      },
    },
  };
}

describe('Pages-static release artifact gate', () => {
  it('pins the exact 18 product-to-stock and analysis-basis mappings', () => {
    const entries = Object.entries(PAGES_STATIC_PRODUCT_EXPECTATIONS);
    expect(entries).toHaveLength(18);
    expect(entries.filter(([, expected]) => expected.underlyingId === '005930')).toHaveLength(9);
    expect(entries.filter(([, expected]) => expected.underlyingId === '000660')).toHaveLength(9);
    expect(
      entries.filter(([, expected]) => expected.analysisBasis === 'underlying-stock'),
    ).toHaveLength(10);
    expect(
      entries.filter(([, expected]) => expected.analysisBasis === 'reference-stock-proxy'),
    ).toHaveLength(8);
    expect(
      entries.filter(([, expected]) => expected.baseIndexType === 'futures-index'),
    ).toHaveLength(6);
    expect(
      entries.filter(([, expected]) => expected.baseIndexType === 'total-return-index'),
    ).toHaveLength(2);
  });

  it('accepts a live full export with nonempty internally consistent series and a common date', () => {
    expect(validatePagesStaticProductExport('0198B0.json', validPayload())).toEqual([]);
  });

  it('rejects missing integrity evidence without trusting the filename alone', () => {
    const emptyUnderlying = validPayload();
    emptyUnderlying.data.underlyingSeries = [];
    expect(validatePagesStaticProductExport('0198B0.json', emptyUnderlying)).toContain(
      'UNDERLYING_SERIES_INVALID',
    );

    const wrongUnderlying = validPayload();
    wrongUnderlying.data.product.underlyingId = '000660';
    expect(validatePagesStaticProductExport('0198B0.json', wrongUnderlying)).toContain(
      'PRODUCT_METADATA_MISMATCH',
    );

    const wrongLatest = validPayload();
    wrongLatest.data.latest.underlying = { date: '2026-08-26', close: 69_500 };
    expect(validatePagesStaticProductExport('0198B0.json', wrongLatest)).toContain(
      'LATEST_UNDERLYING_MISMATCH',
    );

    const noCommonDate = validPayload();
    noCommonDate.data.underlyingSeries = [{ date: '2026-08-26', close: 69_500 }];
    noCommonDate.data.latest.underlying = { date: '2026-08-26', close: 69_500 };
    expect(validatePagesStaticProductExport('0198B0.json', noCommonDate)).toContain(
      'NO_COMMON_TRADE_DATE',
    );
  });
});
