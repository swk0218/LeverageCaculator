import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  calculateActualPerformance,
  calculateLotTheory,
  calculatePurchaseSummary,
  calculateUnderlyingBreakEvenScenario,
  type PricePoint,
  type Purchase,
} from '../src/index.js';

const dates = [
  '2026-01-02',
  '2026-01-05',
  '2026-01-06',
  '2026-01-07',
  '2026-01-08',
  '2026-01-09',
] as const;

describe('calculation properties', () => {
  it('leverage 1 makes simple and daily compounded returns identical', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 1_000_000 }), { minLength: 1, maxLength: dates.length }),
        (closes) => {
          const series: PricePoint[] = closes.map((close, index) => ({
            date: dates[index]!,
            close,
          }));
          const purchase: Purchase = {
            id: 'property-lot',
            date: dates[0],
            priceWon: 10_000,
            quantity: 3,
          };
          const result = calculateLotTheory(purchase, series, dates[closes.length - 1]!, 1);
          const returnTolerance = 1e-10 * Math.max(1, Math.abs(result.simpleTheoreticalReturn));
          expect(
            Math.abs(result.dailyTheoreticalReturn - result.simpleTheoreticalReturn),
          ).toBeLessThanOrEqual(returnTolerance);
          expect(Math.abs(result.compoundEffectWon)).toBeLessThanOrEqual(
            returnTolerance * result.principalWon,
          );
        },
      ),
    );
  });

  it('weighted average and actual P/L retain their accounting identities', () => {
    const lotArbitrary = fc.record({
      priceWon: fc.integer({ min: 1, max: 1_000_000 }),
      quantity: fc.integer({ min: 1, max: 10_000 }),
    });
    fc.assert(
      fc.property(
        fc.array(lotArbitrary, { minLength: 1, maxLength: 20 }),
        fc.integer({ min: 1, max: 1_000_000 }),
        (lots, currentPrice) => {
          const purchases: Purchase[] = lots.map((lot, index) => ({
            id: `lot-${index}`,
            date: '2026-01-02',
            ...lot,
          }));
          const summary = calculatePurchaseSummary(purchases);
          expect(
            Math.abs(summary.averagePriceWon * summary.totalQuantity - summary.totalCostWon),
          ).toBeLessThanOrEqual(Number.EPSILON * Math.max(1, summary.totalCostWon) * 2);
          const actual = calculateActualPerformance(purchases, currentPrice);
          expect(actual.actualPnlWon).toBe(
            currentPrice * summary.totalQuantity - summary.totalCostWon,
          );
          expect(actual.actualReturn).toBeCloseTo(
            actual.currentValueWon / summary.totalCostWon - 1,
            12,
          );
        },
      ),
    );
  });

  it('every feasible break-even result reconstructs the required product multiplier', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1_000_000 }),
        fc.integer({ min: 1, max: 1_000_000 }),
        fc.constantFrom(-3, -2, -1, 1, 2, 3),
        fc.integer({ min: 1, max: 40 }),
        (averagePrice, currentPrice, leverage, tradingDays) => {
          const result = calculateUnderlyingBreakEvenScenario(
            averagePrice,
            currentPrice,
            leverage,
            tradingDays,
          );
          if (!result.isPossible) return;
          const expectedMultiplier = averagePrice / currentPrice;
          expect(
            Math.abs(result.verificationProductMultiplier! - expectedMultiplier),
          ).toBeLessThanOrEqual(1e-10 * Math.max(1, Math.abs(expectedMultiplier)));
          expect(1 + result.dailyUnderlyingReturn!).toBeGreaterThan(0);
        },
      ),
    );
  });
});
