import { describe, expect, it } from 'vitest';

import {
  AnalysisInputError,
  formatAveragePriceWon,
  formatDetailedPercent,
  formatIndexPoints,
  formatPercent,
  formatPercentagePoints,
  formatQuantity,
  formatSignedWon,
  formatWon,
  isISODate,
  normalizePriceSeries,
  validateAnalysisInput,
  validatePriceSeries,
  validatePurchase,
  validatePurchaseDate,
  type AnalysisInput,
  type Product,
} from '../src/index.js';

const validProduct: Product = {
  code: 'TEST',
  name: '테스트',
  productType: 'ETF',
  leverage: 2,
  underlyingId: 'UNDER',
  underlyingName: '기초',
  underlyingType: 'stock',
  listedDate: '2026-01-01',
  analysisCapability: 'full',
  active: true,
};

describe('timezone-free date and input validation', () => {
  it('accepts real calendar dates and rejects malformed or impossible dates', () => {
    expect(isISODate('2024-02-29')).toBe(true);
    expect(isISODate('2023-02-29')).toBe(false);
    expect(isISODate('0000-01-01')).toBe(false);
    expect(isISODate('2026-00-01')).toBe(false);
    expect(isISODate('2026-13-01')).toBe(false);
    expect(isISODate('2026-04-31')).toBe(false);
    expect(isISODate('2026-01-00')).toBe(false);
    expect(isISODate('2026-1-01')).toBe(false);
    expect(isISODate(20260101)).toBe(false);
  });

  it('validates listing date, future date and exact official-price availability', () => {
    expect(validatePurchaseDate('not-a-date')).toHaveLength(1);
    const issues = validatePurchaseDate('2026-01-02', {
      listedDate: '2026-01-03',
      today: '2026-01-01',
      availableDates: new Set(['2026-01-05']),
    });
    expect(issues.map(({ code }) => code)).toEqual([
      'date.before-listed',
      'date.future',
      'date.price-unavailable',
    ]);
    expect(
      validatePurchaseDate('2026-01-02', {
        availableDates: ['2026-01-02'],
      }),
    ).toEqual([]);
  });

  it('reports only the invalid purchase fields with stable paths', () => {
    const issues = validatePurchase(
      { id: ' ', date: '2025-12-31', priceWon: 0.5, quantity: 0 },
      { index: 4, listedDate: '2026-01-01' },
    );
    expect(issues.map(({ path }) => path)).toEqual([
      'purchases[4].id',
      'purchases[4].date',
      'purchases[4].priceWon',
      'purchases[4].quantity',
    ]);
  });

  it('rejects duplicate dates and invalid prices, and sorts a valid copy', () => {
    const issues = validatePriceSeries([
      { date: 'invalid', close: 0 },
      { date: '2026-01-02', close: 100 },
      { date: '2026-01-02', close: Number.NaN },
    ]);
    expect(issues.map(({ code }) => code)).toEqual([
      'series.invalid-date',
      'series.invalid-close',
      'series.duplicate-date',
      'series.invalid-close',
    ]);
    expect(() => normalizePriceSeries([{ date: 'bad', close: 1 }])).toThrow(AnalysisInputError);
    expect(
      normalizePriceSeries([
        { date: '2026-01-03', close: 3 },
        { date: '2026-01-02', close: 2 },
      ]),
    ).toEqual([
      { date: '2026-01-02', close: 2 },
      { date: '2026-01-03', close: 3 },
    ]);
  });

  it('collects analysis input issues instead of silently coercing values', () => {
    const input: AnalysisInput = {
      product: {
        ...validProduct,
        code: '',
        name: '',
        productType: 'FUND' as Product['productType'],
        leverage: 0,
        underlyingId: '',
        underlyingName: '',
        underlyingType: 'bond' as Product['underlyingType'],
        listedDate: 'bad',
        analysisCapability: 'none' as Product['analysisCapability'],
        active: 'yes' as unknown as boolean,
      },
      purchases: [
        { id: 'duplicate', date: '2026-01-02', priceWon: 100, quantity: 1 },
        { id: 'duplicate', date: '2026-01-02', priceWon: 100, quantity: 1 },
      ],
      currentProductPrice: Number.POSITIVE_INFINITY,
      productSeries: [{ date: 'bad', close: -1 }],
      underlyingSeries: [{ date: '2026-01-02', close: 0 }],
    };
    const codes = validateAnalysisInput(input).map(({ code }) => code);
    expect(codes).toEqual(
      expect.arrayContaining([
        'product.code-required',
        'product.name-required',
        'product.invalid-type',
        'product.underlying-required',
        'product.invalid-leverage',
        'product.invalid-underlying-type',
        'product.invalid-analysis-capability',
        'product.invalid-active',
        'product.invalid-listed-date',
        'purchase.duplicate-id',
        'current-price.invalid',
        'series.invalid-date',
        'series.invalid-close',
      ]),
    );
  });

  it('enforces the 1 to 50 purchase bound and analyzePosition rejects invalid input', async () => {
    const empty: AnalysisInput = {
      product: validProduct,
      purchases: [],
      currentProductPrice: 100,
      productSeries: [],
      underlyingSeries: [],
    };
    expect(validateAnalysisInput(empty).map(({ code }) => code)).toContain('purchases.count');

    const { analyzePosition } = await import('../src/index.js');
    expect(() => analyzePosition(empty)).toThrow(AnalysisInputError);
    expect(
      validateAnalysisInput({
        ...empty,
        purchases: Array.from({ length: 51 }, (_, index) => ({
          id: `${index}`,
          date: '2026-01-02',
          priceWon: 1,
          quantity: 1,
        })),
      }).map(({ code }) => code),
    ).toContain('purchases.count');
  });
});

describe('display formatting', () => {
  it('rounds won and quantities only at display time', () => {
    expect(formatWon(1_234.6)).toBe('1,235원');
    expect(formatAveragePriceWon(1_234.4)).toBe('1,234원');
    expect(formatSignedWon(1_000)).toBe('+1,000원');
    expect(formatSignedWon(-1_000)).toBe('-1,000원');
    expect(formatQuantity(1_234)).toBe('1,234주');
    expect(formatIndexPoints(3_215.678)).toBe('3,215.68포인트');
  });

  it('formats major, detailed and percentage-point rates', () => {
    expect(formatPercent(0.2294)).toBe('+22.9%');
    expect(formatPercent(-0.1864)).toBe('-18.6%');
    expect(formatPercent(0.2294, 2, false)).toBe('22.94%');
    expect(formatDetailedPercent(0.2)).toBe('+20%');
    expect(formatDetailedPercent(-0.03745)).toBe('-3.75%');
    expect(formatPercentagePoints(-0.037)).toBe('-3.7%p');
  });

  it('never displays negative zero, NaN, or Infinity', () => {
    expect(formatWon(-0.4)).toBe('0원');
    expect(formatSignedWon(-0.4)).toBe('0원');
    expect(formatQuantity(-0)).toBe('0주');
    expect(formatPercent(-0.00001)).toBe('0.0%');
    expect(formatDetailedPercent(-0.000001)).toBe('0%');
    expect(formatPercentagePoints(-0.00001)).toBe('0.0%p');
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(formatWon(value)).toBe('—');
      expect(formatSignedWon(value)).toBe('—');
      expect(formatQuantity(value)).toBe('—');
      expect(formatIndexPoints(value)).toBe('—');
      expect(formatPercent(value)).toBe('—');
      expect(formatDetailedPercent(value)).toBe('—');
      expect(formatPercentagePoints(value)).toBe('—');
    }
  });
});
