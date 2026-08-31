import { describe, expect, it } from 'vitest';

import {
  CalculationError,
  analyzePosition,
  calculateActualPerformance,
  calculateLotTheory,
  calculateProductBreakEvenReturn,
  calculatePurchaseSummary,
  calculateTransactionLedger,
  calculateUnderlyingBreakEvenScenario,
  calculateUnderlyingBreakEvenScenarios,
  findLatestCommonAnalysisDate,
  normalizeZero,
  type AnalysisInput,
  type PricePoint,
  type Product,
  type Purchase,
  type Sale,
} from '../src/index.js';

const product = (overrides: Partial<Product> = {}): Product => ({
  code: 'TEST2X',
  name: '테스트 레버리지 2X',
  productType: 'ETF',
  leverage: 2,
  underlyingId: 'UNDERLYING',
  underlyingName: '테스트 기초자산',
  underlyingType: 'stock',
  listedDate: '2026-01-01',
  analysisCapability: 'full',
  active: true,
  ...overrides,
});

const point = (date: string, close: number): PricePoint => ({ date, close });
const purchase = (overrides: Partial<Purchase> = {}): Purchase => ({
  id: 'lot-1',
  date: '2026-01-02',
  priceWon: 100,
  quantity: 1,
  ...overrides,
});

describe('mandatory golden vectors', () => {
  it('calculates consecutive gains: 100 -> 110 -> 121 at +2X', () => {
    const result = calculateLotTheory(
      purchase(),
      [point('2026-01-02', 100), point('2026-01-05', 110), point('2026-01-06', 121)],
      '2026-01-06',
      2,
    );

    expect(result.underlyingPeriodReturn).toBeCloseTo(0.21, 12);
    expect(result.simpleTheoreticalReturn).toBeCloseTo(0.42, 12);
    expect(result.dailyTheoreticalReturn).toBeCloseTo(0.44, 12);
    expect(result.compoundEffectWon / result.principalWon).toBeCloseTo(0.02, 12);
  });

  it('calculates a gain followed by a loss: 100 -> 110 -> 99 at +2X', () => {
    const result = calculateLotTheory(
      purchase(),
      [point('2026-01-02', 100), point('2026-01-05', 110), point('2026-01-06', 99)],
      '2026-01-06',
      2,
    );

    expect(result.underlyingPeriodReturn).toBeCloseTo(-0.01, 12);
    expect(result.simpleTheoreticalReturn).toBeCloseTo(-0.02, 12);
    expect(result.dailyTheoreticalReturn).toBeCloseTo(-0.04, 12);
    expect(result.compoundEffectWon / result.principalWon).toBeCloseTo(-0.02, 12);
  });

  it('preserves the inverse 2X signs for 100 -> 110 -> 99', () => {
    const result = calculateLotTheory(
      purchase(),
      [point('2026-01-02', 100), point('2026-01-05', 110), point('2026-01-06', 99)],
      '2026-01-06',
      -2,
    );

    expect(result.simpleTheoreticalReturn).toBeCloseTo(0.02, 12);
    expect(result.dailyTheoreticalReturn).toBeCloseTo(-0.04, 12);
    expect(result.compoundEffectWon / result.principalWon).toBeCloseTo(-0.06, 12);
  });

  it('aggregates multiple purchase lots and compares official actual performance', () => {
    const input: AnalysisInput = {
      product: product(),
      purchases: [
        purchase({ id: 'day-0', date: '2026-01-02', priceWon: 100, quantity: 1 }),
        purchase({ id: 'day-1', date: '2026-01-05', priceWon: 120, quantity: 2 }),
      ],
      currentProductPrice: 96,
      productSeries: [point('2026-01-02', 100), point('2026-01-05', 120), point('2026-01-06', 96)],
      underlyingSeries: [
        point('2026-01-02', 100),
        point('2026-01-05', 110),
        point('2026-01-06', 99),
      ],
    };

    const result = analyzePosition(input);
    expect(result.totalCostWon).toBe(340);
    expect(result.totalQuantity).toBe(3);
    expect(result.averagePriceWon).toBeCloseTo(113.33333333333333, 12);
    expect(result.currentValueWon).toBe(288);
    expect(result.actualPnlWon).toBe(-52);
    expect(result.actualReturn).toBeCloseTo(-0.15294117647058825, 12);
    expect(result.simpleTheoreticalPnlWon).toBeCloseTo(-50, 12);
    expect(result.dailyTheoreticalPnlWon).toBeCloseTo(-52, 12);
    expect(result.compoundEffectWon).toBeCloseTo(-2, 12);
    expect(result.compoundEffectRate).toBeCloseTo(-0.00588235294117647, 12);
    expect(result.theoreticalActualGapWon).toBeCloseTo(0, 12);
    expect(result.analysisDate).toBe('2026-01-06');
    expect(result.analysisCoverage).toBe('full');
    expect(result.analyzedPurchaseIds).toEqual(['day-0', 'day-1']);
    expect(result.excludedPurchaseIds).toEqual([]);
    expect(result.lotTheory).toHaveLength(2);
    expect(result.officialAnalysisPnlWon).toBe(-52);
    expect(result.officialAnalysisReturn).toBeCloseTo(-52 / 340, 12);
  });

  it('calculates 1, 5 and 20-day underlying break-even conditions', () => {
    expect(calculateProductBreakEvenReturn(120, 90)).toBeCloseTo(1 / 3, 12);
    const scenarios = calculateUnderlyingBreakEvenScenarios(120, 90, 2, [1, 5, 20], 100);

    expect(scenarios.map((scenario) => scenario.tradingDays)).toEqual([1, 5, 20]);
    expect(scenarios.every((scenario) => scenario.isPossible)).toBe(true);
    expect(scenarios[0]?.cumulativeUnderlyingReturn).toBeCloseTo(0.16666666666666666, 12);
    expect(scenarios[1]?.cumulativeUnderlyingReturn).toBeCloseTo(0.157091785, 9);
    expect(scenarios[2]?.cumulativeUnderlyingReturn).toBeCloseTo(0.155297964, 9);
    expect(scenarios[2]?.targetUnderlyingPrice).toBeCloseTo(115.5297964, 7);
    for (const scenario of scenarios) {
      expect(scenario.verificationProductMultiplier).toBeCloseTo(120 / 90, 12);
    }
  });
});

describe('calculation edge cases and analysis coverage', () => {
  it('accounts for a partial sale with FIFO cost basis', () => {
    const purchases = [
      purchase({ id: 'first', date: '2026-01-02', priceWon: 100, quantity: 10 }),
      purchase({ id: 'second', date: '2026-01-05', priceWon: 120, quantity: 5 }),
    ];
    const sales: Sale[] = [{ id: 'sale-1', date: '2026-01-06', priceWon: 150, quantity: 6 }];
    expect(calculateTransactionLedger(purchases, sales)).toMatchObject({
      totalPurchaseCostWon: 1_600,
      totalSaleProceedsWon: 900,
      soldQuantity: 6,
      remainingQuantity: 9,
      remainingCostWon: 1_000,
      remainingAveragePriceWon: 1_000 / 9,
      realizedPnlWon: 300,
    });
    expect(calculateActualPerformance(purchases, 130, sales)).toMatchObject({
      totalCostWon: 1_600,
      totalQuantity: 9,
      currentValueWon: 1_170,
      actualPnlWon: 470,
      realizedPnlWon: 300,
      unrealizedPnlWon: 170,
      actualReturn: 470 / 1_600,
    });
  });

  it('rejects a sale larger than the shares held on that date', () => {
    expect(() =>
      calculateTransactionLedger(
        [purchase({ quantity: 2 })],
        [{ id: 'sale-1', date: '2026-01-05', priceWon: 120, quantity: 3 }],
      ),
    ).toThrow('매도 수량이 보유수량보다 많습니다');
  });

  it('calculates purchase summary, current P/L, and already-above-break-even values', () => {
    const purchases = [
      purchase({ priceWon: 1_000, quantity: 2 }),
      purchase({ id: 'lot-2', priceWon: 2_000, quantity: 1 }),
    ];
    expect(calculatePurchaseSummary(purchases)).toEqual({
      totalCostWon: 4_000,
      totalQuantity: 3,
      averagePriceWon: 4_000 / 3,
    });
    expect(calculateActualPerformance(purchases, 2_000)).toMatchObject({
      currentValueWon: 6_000,
      actualPnlWon: 2_000,
      actualReturn: 0.5,
    });
    expect(calculateProductBreakEvenReturn(1_000, 2_000)).toBe(-0.5);
  });

  it('sorts series without mutating them and chooses the latest common date', () => {
    const products = [point('2026-01-07', 3), point('2026-01-05', 2)];
    const underlying = [point('2026-01-06', 12), point('2026-01-05', 11)];
    expect(findLatestCommonAnalysisDate(products, underlying)).toBe('2026-01-05');
    expect(products.map(({ date }) => date)).toEqual(['2026-01-07', '2026-01-05']);
    expect(findLatestCommonAnalysisDate([], underlying)).toBeUndefined();
  });

  it('uses the latest common official date instead of a manually entered current price', () => {
    const result = analyzePosition({
      product: product(),
      purchases: [purchase()],
      currentProductPrice: 130,
      productSeries: [point('2026-01-05', 115), point('2026-01-06', 120)],
      underlyingSeries: [point('2026-01-02', 100), point('2026-01-05', 110)],
    });

    expect(result.actualPnlWon).toBe(30);
    expect(result.analysisDate).toBe('2026-01-05');
    expect(result.officialAnalysisPnlWon).toBe(15);
  });

  it('returns actual-only results without inventing theoretical values', () => {
    const result = analyzePosition({
      product: product({ analysisCapability: 'actual-only' }),
      purchases: [purchase()],
      currentProductPrice: 90,
      productSeries: [],
      underlyingSeries: [],
    });

    expect(result.actualPnlWon).toBe(-10);
    expect(result.analysisCoverage).toBe('unavailable');
    expect(result.breakEvenScenarios).toEqual([]);
    expect(result.dailyTheoreticalPnlWon).toBeUndefined();
    expect(result.excludedPurchaseIds).toEqual(['lot-1']);
    expect(result.warnings.join(' ')).toContain('실제 손익');
  });

  it('returns unavailable theory when there is no common official date', () => {
    const result = analyzePosition({
      product: product(),
      purchases: [purchase()],
      currentProductPrice: 90,
      productSeries: [point('2026-01-05', 90)],
      underlyingSeries: [point('2026-01-02', 100)],
    });

    expect(result.analysisCoverage).toBe('unavailable');
    expect(result.analysisDate).toBeUndefined();
    expect(result.breakEvenScenarios).toHaveLength(3);
    expect(result.warnings[0]).toContain('공통 공식 거래일');
  });

  it('excludes a missing-price lot and a post-analysis lot with explicit partial warnings', () => {
    const result = analyzePosition({
      product: product(),
      purchases: [
        purchase({ id: 'included' }),
        purchase({ id: 'holiday', date: '2026-01-03' }),
        purchase({ id: 'later', date: '2026-01-07' }),
      ],
      currentProductPrice: 90,
      productSeries: [point('2026-01-02', 100), point('2026-01-06', 96)],
      underlyingSeries: [point('2026-01-02', 100), point('2026-01-06', 99)],
    });

    expect(result.analysisCoverage).toBe('partial');
    expect(result.analyzedPurchaseIds).toEqual(['included']);
    expect(result.excludedPurchaseIds).toEqual(['holiday', 'later']);
    expect(result.analysisCoverageRate).toBeCloseTo(1 / 3, 12);
    expect(result.analyzedCostWon).toBe(100);
    expect(result.analyzedQuantity).toBe(1);
    expect(result.warnings).toHaveLength(3);
    expect(result.warnings.join(' ')).toContain('부분 분석');
    expect(result.warnings.join(' ')).toContain('종가가 없어');
    expect(result.warnings.join(' ')).toContain('이후');
  });

  it('fails closed when an intermediate product trading day has no underlying close', () => {
    const result = analyzePosition({
      product: product(),
      purchases: [purchase({ id: 'spans-gap' })],
      currentProductPrice: 96,
      productSeries: [point('2026-01-02', 100), point('2026-01-05', 98), point('2026-01-06', 96)],
      underlyingSeries: [point('2026-01-02', 100), point('2026-01-06', 99)],
    });

    expect(result.analysisDate).toBe('2026-01-06');
    expect(result.analysisCoverage).toBe('unavailable');
    expect(result.analyzedPurchaseIds).toEqual([]);
    expect(result.excludedPurchaseIds).toEqual(['spans-gap']);
    expect(result.lotTheory).toEqual([]);
    expect(result.dailyTheoreticalPnlWon).toBeUndefined();
    expect(result.warnings.join(' ')).toContain('상품 거래일 2026-01-05');
    expect(result.warnings.join(' ')).toContain('기초자산 종가가 누락');
    expect(result.warnings.join(' ')).toContain('가능한 매수분이 없습니다');
  });

  it('keeps later complete lots as a partial analysis when an earlier lot spans a data gap', () => {
    const result = analyzePosition({
      product: product(),
      purchases: [
        purchase({ id: 'spans-gap' }),
        purchase({ id: 'after-gap', date: '2026-01-06', priceWon: 96 }),
      ],
      currentProductPrice: 96,
      productSeries: [point('2026-01-02', 100), point('2026-01-05', 98), point('2026-01-06', 96)],
      underlyingSeries: [point('2026-01-02', 100), point('2026-01-06', 99)],
    });

    expect(result.analysisCoverage).toBe('partial');
    expect(result.analyzedPurchaseIds).toEqual(['after-gap']);
    expect(result.excludedPurchaseIds).toEqual(['spans-gap']);
    expect(result.lotTheory).toHaveLength(1);
    expect(result.warnings.join(' ')).toContain('상품 거래일 2026-01-05');
    expect(result.warnings.join(' ')).toContain('부분 분석');
  });

  it('keeps analysis date but omits theory when every lot is after it', () => {
    const result = analyzePosition({
      product: product(),
      purchases: [purchase({ date: '2026-01-06' })],
      currentProductPrice: 100,
      productSeries: [point('2026-01-05', 100)],
      underlyingSeries: [point('2026-01-05', 100)],
    });
    expect(result.analysisDate).toBe('2026-01-05');
    expect(result.analysisCoverage).toBe('unavailable');
    expect(result.lotTheory).toEqual([]);
    expect(result.warnings.join(' ')).toContain('가능한 매수분이 없습니다');
  });

  it('marks invalid and mathematically impossible break-even scenarios', () => {
    const invalidPeriod = calculateUnderlyingBreakEvenScenario(120, 90, 2, 0);
    expect(invalidPeriod.isPossible).toBe(false);
    expect(invalidPeriod.reason).toContain('거래일 수');
    expect(calculateUnderlyingBreakEvenScenario(0, 90, 2, 1).isPossible).toBe(false);
    expect(calculateUnderlyingBreakEvenScenario(400, 100, -2, 1).isPossible).toBe(false);
    expect(calculateUnderlyingBreakEvenScenario(120, 90, 2, 1, 0).isPossible).toBe(false);
    expect(calculateUnderlyingBreakEvenScenario(Number.MAX_VALUE, 1, 0.5, 2).isPossible).toBe(
      false,
    );
    expect(calculateUnderlyingBreakEvenScenario(400, 100, 2, 1, Number.MAX_VALUE).isPossible).toBe(
      false,
    );
  });

  it('normalizes negative zero and validates standalone calculation parameters', () => {
    expect(normalizeZero(-0)).toBe(0);
    expect(normalizeZero(0.001, 0.01)).toBe(0);
    expect(normalizeZero(1)).toBe(1);
    expect(() => calculatePurchaseSummary([])).toThrow(CalculationError);
    expect(() =>
      calculatePurchaseSummary(Array.from({ length: 51 }, (_, id) => purchase({ id: `${id}` }))),
    ).toThrow(CalculationError);
    expect(() => calculateActualPerformance([purchase()], 0)).toThrow(CalculationError);
    expect(() => calculateActualPerformance([purchase({ quantity: 2 })], Number.MAX_VALUE)).toThrow(
      CalculationError,
    );
    expect(() => calculateProductBreakEvenReturn(0, 100)).toThrow(CalculationError);
    expect(() => calculateProductBreakEvenReturn(100, Number.NaN)).toThrow(CalculationError);
    expect(() =>
      calculatePurchaseSummary([purchase({ priceWon: Number.MAX_SAFE_INTEGER, quantity: 2 })]),
    ).toThrow('안전한 계산 범위');
  });

  it('rejects missing exact endpoints and invalid lot theory inputs', () => {
    const prices = [point('2026-01-02', 100), point('2026-01-05', 110)];
    expect(() =>
      calculateLotTheory(purchase({ date: '2026-01-03' }), prices, '2026-01-05', 2),
    ).toThrow('매수일');
    expect(() => calculateLotTheory(purchase(), prices, '2026-01-06', 2)).toThrow('분석일');
    expect(() => calculateLotTheory(purchase(), prices, 'invalid', 2)).toThrow('분석일');
    expect(() =>
      calculateLotTheory(purchase({ date: '2026-01-05' }), prices, '2026-01-02', 2),
    ).toThrow('이후');
    expect(() => calculateLotTheory(purchase(), prices, '2026-01-05', 0)).toThrow('상품 배수');
    expect(() =>
      calculateLotTheory(
        purchase(),
        [point('2026-01-02', Number.MIN_VALUE), point('2026-01-05', Number.MAX_VALUE)],
        '2026-01-05',
        2,
      ),
    ).toThrow('숫자 범위');
  });
});
