import type {
  ActualPerformance,
  AnalysisInput,
  AnalysisResult,
  BreakEvenScenario,
  ISODate,
  LotTheoryResult,
  PricePoint,
  Purchase,
  PurchaseSummary,
} from './types.js';
import {
  AnalysisInputError,
  assertValidAnalysisInput,
  isISODate,
  normalizePriceSeries,
  validatePurchase,
} from './validation.js';

export const DEFAULT_BREAK_EVEN_PERIODS = [1, 5, 20] as const;

export class CalculationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CalculationError';
  }
}

export function normalizeZero(value: number, epsilon = 0): number {
  return Object.is(value, -0) || Math.abs(value) <= epsilon ? 0 : value;
}

function requirePositiveFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new CalculationError(`${label}은(는) 0보다 큰 유한수여야 합니다.`);
  }
}

function requireFiniteNonZero(value: number, label: string): void {
  if (!Number.isFinite(value) || value === 0) {
    throw new CalculationError(`${label}은(는) 0이 아닌 유한수여야 합니다.`);
  }
}

export function calculatePurchaseSummary(purchases: readonly Purchase[]): PurchaseSummary {
  if (purchases.length < 1 || purchases.length > 50) {
    throw new CalculationError('매수내역은 1개 이상 50개 이하여야 합니다.');
  }

  const issues = purchases.flatMap((purchase, index) => validatePurchase(purchase, { index }));
  if (issues.length > 0) throw new AnalysisInputError(issues);

  const totalCostWon = purchases.reduce(
    (total, purchase) => total + purchase.priceWon * purchase.quantity,
    0,
  );
  const totalQuantity = purchases.reduce((total, purchase) => total + purchase.quantity, 0);
  if (!Number.isSafeInteger(totalCostWon) || !Number.isSafeInteger(totalQuantity)) {
    throw new CalculationError('총매수금액 또는 총수량이 안전한 계산 범위를 벗어났습니다.');
  }

  return {
    totalCostWon,
    totalQuantity,
    averagePriceWon: totalCostWon / totalQuantity,
  };
}

export function calculateActualPerformance(
  purchases: readonly Purchase[],
  currentProductPrice: number,
): ActualPerformance {
  requirePositiveFinite(currentProductPrice, '현재 상품 가격');
  const summary = calculatePurchaseSummary(purchases);
  const currentValueWon = currentProductPrice * summary.totalQuantity;
  const actualPnlWon = currentValueWon - summary.totalCostWon;

  if (!Number.isFinite(currentValueWon) || !Number.isFinite(actualPnlWon)) {
    throw new CalculationError('현재 손익이 안전한 계산 범위를 벗어났습니다.');
  }

  return {
    ...summary,
    currentValueWon: normalizeZero(currentValueWon),
    actualPnlWon: normalizeZero(actualPnlWon),
    actualReturn: normalizeZero(currentValueWon / summary.totalCostWon - 1),
  };
}

export function calculateProductBreakEvenReturn(
  averagePriceWon: number,
  currentProductPrice: number,
): number {
  requirePositiveFinite(averagePriceWon, '평균 매수가');
  requirePositiveFinite(currentProductPrice, '현재 상품 가격');
  return normalizeZero(averagePriceWon / currentProductPrice - 1);
}

function impossibleScenario(tradingDays: number, reason: string): BreakEvenScenario {
  return { tradingDays, isPossible: false, reason };
}

export function calculateUnderlyingBreakEvenScenario(
  averagePriceWon: number,
  currentProductPrice: number,
  leverage: number,
  tradingDays: number,
  currentUnderlyingPrice?: number,
): BreakEvenScenario {
  if (!Number.isInteger(tradingDays) || tradingDays < 1) {
    return impossibleScenario(tradingDays, '거래일 수는 1 이상의 정수여야 합니다.');
  }
  if (
    !Number.isFinite(averagePriceWon) ||
    averagePriceWon <= 0 ||
    !Number.isFinite(currentProductPrice) ||
    currentProductPrice <= 0 ||
    !Number.isFinite(leverage) ||
    leverage === 0
  ) {
    return impossibleScenario(tradingDays, '평단, 현재가, 상품 배수를 확인할 수 없습니다.');
  }

  const requiredProductMultiple = averagePriceWon / currentProductPrice;
  const requiredDailyUnderlyingReturn =
    (Math.pow(requiredProductMultiple, 1 / tradingDays) - 1) / leverage;
  const dailyUnderlyingFactor = 1 + requiredDailyUnderlyingReturn;

  if (!Number.isFinite(requiredDailyUnderlyingReturn) || dailyUnderlyingFactor <= 0) {
    return impossibleScenario(
      tradingDays,
      '기초자산 가격이 0 이하가 되어야 하므로 이 가정에서는 본전 계산이 불가능합니다.',
    );
  }

  const cumulativeUnderlyingReturn = Math.pow(dailyUnderlyingFactor, tradingDays) - 1;
  if (!Number.isFinite(cumulativeUnderlyingReturn)) {
    return impossibleScenario(tradingDays, '본전 계산 결과가 유효한 숫자 범위를 벗어났습니다.');
  }

  const scenario: BreakEvenScenario = {
    tradingDays,
    isPossible: true,
    dailyUnderlyingReturn: normalizeZero(requiredDailyUnderlyingReturn),
    cumulativeUnderlyingReturn: normalizeZero(cumulativeUnderlyingReturn),
    verificationProductMultiplier: Math.pow(
      1 + leverage * requiredDailyUnderlyingReturn,
      tradingDays,
    ),
  };
  if (currentUnderlyingPrice !== undefined) {
    if (!Number.isFinite(currentUnderlyingPrice) || currentUnderlyingPrice <= 0) {
      return impossibleScenario(tradingDays, '현재 기초자산 가격을 확인할 수 없습니다.');
    }
    const targetUnderlyingPrice = currentUnderlyingPrice * (1 + cumulativeUnderlyingReturn);
    if (!Number.isFinite(targetUnderlyingPrice) || targetUnderlyingPrice <= 0) {
      return impossibleScenario(tradingDays, '목표 기초자산 가격을 계산할 수 없습니다.');
    }
    scenario.targetUnderlyingPrice = normalizeZero(targetUnderlyingPrice);
  }
  return scenario;
}

export function calculateUnderlyingBreakEvenScenarios(
  averagePriceWon: number,
  currentProductPrice: number,
  leverage: number,
  periods: readonly number[] = DEFAULT_BREAK_EVEN_PERIODS,
  currentUnderlyingPrice?: number,
): BreakEvenScenario[] {
  return periods.map((period) =>
    calculateUnderlyingBreakEvenScenario(
      averagePriceWon,
      currentProductPrice,
      leverage,
      period,
      currentUnderlyingPrice,
    ),
  );
}

export const calculateBreakEvenScenarios = calculateUnderlyingBreakEvenScenarios;

export function findLatestCommonAnalysisDate(
  productSeries: readonly PricePoint[],
  underlyingSeries: readonly PricePoint[],
): ISODate | undefined {
  const products = normalizePriceSeries(productSeries);
  const underlyingDates = new Set(
    normalizePriceSeries(underlyingSeries).map((point) => point.date),
  );
  for (let index = products.length - 1; index >= 0; index -= 1) {
    const point = products[index];
    if (point && underlyingDates.has(point.date)) return point.date;
  }
  return undefined;
}

function priceAt(series: readonly PricePoint[], date: ISODate): number | undefined {
  return series.find((point) => point.date === date)?.close;
}

export function calculateLotTheory(
  purchase: Purchase,
  underlyingSeries: readonly PricePoint[],
  analysisDate: ISODate,
  leverage: number,
): LotTheoryResult {
  const purchaseIssues = validatePurchase(purchase);
  if (purchaseIssues.length > 0) throw new AnalysisInputError(purchaseIssues);
  if (!isISODate(analysisDate)) throw new CalculationError('분석일이 유효하지 않습니다.');
  requireFiniteNonZero(leverage, '상품 배수');
  if (purchase.date > analysisDate) {
    throw new CalculationError('분석일 이후 매수분은 복리 분석에 포함할 수 없습니다.');
  }

  const prices = normalizePriceSeries(underlyingSeries).filter(
    (point) => point.date >= purchase.date && point.date <= analysisDate,
  );
  const first = prices[0];
  const last = prices.at(-1);
  if (!first || first.date !== purchase.date) {
    throw new CalculationError('매수일의 기초자산 종가가 없습니다.');
  }
  if (!last || last.date !== analysisDate) {
    throw new CalculationError('분석일의 기초자산 종가가 없습니다.');
  }

  const underlyingPeriodReturn = last.close / first.close - 1;
  const simpleTheoreticalReturn = leverage * underlyingPeriodReturn;
  let dailyValueFactor = 1;
  for (let index = 1; index < prices.length; index += 1) {
    const previous = prices[index - 1]!;
    const current = prices[index]!;
    const dailyUnderlyingReturn = current.close / previous.close - 1;
    dailyValueFactor *= 1 + leverage * dailyUnderlyingReturn;
  }
  const dailyTheoreticalReturn = dailyValueFactor - 1;
  const principalWon = purchase.priceWon * purchase.quantity;
  const simpleTheoreticalPnlWon = principalWon * simpleTheoreticalReturn;
  const dailyTheoreticalPnlWon = principalWon * dailyTheoreticalReturn;

  const values = [
    underlyingPeriodReturn,
    simpleTheoreticalReturn,
    dailyTheoreticalReturn,
    simpleTheoreticalPnlWon,
    dailyTheoreticalPnlWon,
  ];
  if (values.some((value) => !Number.isFinite(value))) {
    throw new CalculationError('복리 분석 결과가 유효한 숫자 범위를 벗어났습니다.');
  }

  return {
    purchaseId: purchase.id,
    purchaseDate: purchase.date,
    analysisDate,
    principalWon,
    startUnderlyingPrice: first.close,
    endUnderlyingPrice: last.close,
    underlyingPeriodReturn: normalizeZero(underlyingPeriodReturn),
    simpleTheoreticalReturn: normalizeZero(simpleTheoreticalReturn),
    dailyTheoreticalReturn: normalizeZero(dailyTheoreticalReturn),
    simpleTheoreticalPnlWon: normalizeZero(simpleTheoreticalPnlWon),
    dailyTheoreticalPnlWon: normalizeZero(dailyTheoreticalPnlWon),
    compoundEffectWon: normalizeZero(dailyTheoreticalPnlWon - simpleTheoreticalPnlWon),
  };
}

function actualOnlyWarning(): string {
  return '이 상품은 기초자산 분석을 지원하지 않아 실제 손익과 상품 본전 조건만 계산했습니다.';
}

function noCommonDateWarning(): string {
  return '상품과 기초자산에 공통 공식 거래일이 없어 복리 분석을 계산하지 못했습니다.';
}

export function analyzePosition(
  input: AnalysisInput,
  periods: readonly number[] = DEFAULT_BREAK_EVEN_PERIODS,
): AnalysisResult {
  assertValidAnalysisInput(input);
  const actual = calculateActualPerformance(input.purchases, input.currentProductPrice);
  const productBreakEvenReturn = calculateProductBreakEvenReturn(
    actual.averagePriceWon,
    input.currentProductPrice,
  );
  const baseResult = {
    ...actual,
    productBreakEvenReturn,
    warnings: [] as string[],
    analyzedPurchaseIds: [] as string[],
    excludedPurchaseIds: [] as string[],
    lotTheory: [] as LotTheoryResult[],
  };

  if (input.product.analysisCapability === 'actual-only') {
    return {
      ...baseResult,
      breakEvenScenarios: [],
      warnings: [actualOnlyWarning()],
      analysisCoverage: 'unavailable',
      excludedPurchaseIds: input.purchases.map((purchase) => purchase.id),
    };
  }

  const productSeries = normalizePriceSeries(input.productSeries);
  const underlyingSeries = normalizePriceSeries(input.underlyingSeries);
  const analysisDate = findLatestCommonAnalysisDate(productSeries, underlyingSeries);
  if (!analysisDate) {
    return {
      ...baseResult,
      breakEvenScenarios: calculateUnderlyingBreakEvenScenarios(
        actual.averagePriceWon,
        input.currentProductPrice,
        input.product.leverage,
        periods,
      ),
      warnings: [noCommonDateWarning()],
      analysisCoverage: 'unavailable',
      excludedPurchaseIds: input.purchases.map((purchase) => purchase.id),
    };
  }

  const currentUnderlyingPrice = priceAt(underlyingSeries, analysisDate);
  const breakEvenScenarios = calculateUnderlyingBreakEvenScenarios(
    actual.averagePriceWon,
    input.currentProductPrice,
    input.product.leverage,
    periods,
    currentUnderlyingPrice,
  );
  const warnings: string[] = [];
  const lotTheory: LotTheoryResult[] = [];
  const excludedPurchaseIds: string[] = [];

  for (const purchase of input.purchases) {
    if (purchase.date > analysisDate) {
      excludedPurchaseIds.push(purchase.id);
      warnings.push(
        `매수분 ${purchase.id}은(는) 공식 분석일 ${analysisDate} 이후이므로 복리 분석에서 제외했습니다.`,
      );
    } else if (priceAt(underlyingSeries, purchase.date) === undefined) {
      excludedPurchaseIds.push(purchase.id);
      warnings.push(
        `매수분 ${purchase.id}은(는) ${purchase.date} 기초자산 종가가 없어 복리 분석에서 제외했습니다.`,
      );
    } else {
      lotTheory.push(
        calculateLotTheory(purchase, underlyingSeries, analysisDate, input.product.leverage),
      );
    }
  }

  const analyzedPurchaseIds = lotTheory.map((lot) => lot.purchaseId);
  const analysisCoverage =
    lotTheory.length === input.purchases.length
      ? 'full'
      : lotTheory.length > 0
        ? 'partial'
        : 'unavailable';
  if (analysisCoverage === 'partial') {
    warnings.push(
      `일부 매수분만 복리 분석에 포함된 부분 분석입니다. (${lotTheory.length}/${input.purchases.length}건)`,
    );
  } else if (analysisCoverage === 'unavailable') {
    warnings.push('복리 분석 가능한 매수분이 없습니다.');
  }

  if (lotTheory.length === 0) {
    return {
      ...baseResult,
      breakEvenScenarios,
      analysisDate,
      warnings,
      analysisCoverage,
      analyzedPurchaseIds,
      excludedPurchaseIds,
    };
  }

  const simpleTheoreticalPnlWon = lotTheory.reduce(
    (total, lot) => total + lot.simpleTheoreticalPnlWon,
    0,
  );
  const dailyTheoreticalPnlWon = lotTheory.reduce(
    (total, lot) => total + lot.dailyTheoreticalPnlWon,
    0,
  );
  const compoundEffectWon = dailyTheoreticalPnlWon - simpleTheoreticalPnlWon;
  const analyzedCostWon = lotTheory.reduce((total, lot) => total + lot.principalWon, 0);
  const analyzedPurchases = input.purchases.filter((purchase) =>
    analyzedPurchaseIds.includes(purchase.id),
  );
  const analyzedQuantity = analyzedPurchases.reduce(
    (total, purchase) => total + purchase.quantity,
    0,
  );
  // The common-date selection above proves that this lookup exists.
  const officialProductPrice = priceAt(productSeries, analysisDate) as number;
  const officialAnalysisPnlWon = officialProductPrice * analyzedQuantity - analyzedCostWon;
  const theoreticalActualGapWon = officialAnalysisPnlWon - dailyTheoreticalPnlWon;
  const denominator = actual.totalCostWon;

  return {
    ...baseResult,
    breakEvenScenarios,
    simpleTheoreticalPnlWon: normalizeZero(simpleTheoreticalPnlWon),
    dailyTheoreticalPnlWon: normalizeZero(dailyTheoreticalPnlWon),
    compoundEffectWon: normalizeZero(compoundEffectWon),
    compoundEffectRate: normalizeZero(compoundEffectWon / denominator),
    theoreticalActualGapWon: normalizeZero(theoreticalActualGapWon),
    analysisDate,
    warnings,
    analysisCoverage,
    analyzedCostWon,
    analyzedQuantity,
    analysisCoverageRate: normalizeZero(analyzedCostWon / denominator),
    simpleTheoreticalReturn: normalizeZero(simpleTheoreticalPnlWon / denominator),
    dailyTheoreticalReturn: normalizeZero(dailyTheoreticalPnlWon / denominator),
    officialAnalysisPnlWon: normalizeZero(officialAnalysisPnlWon),
    officialAnalysisReturn: normalizeZero(officialAnalysisPnlWon / denominator),
    theoreticalActualGapRate: normalizeZero(theoreticalActualGapWon / denominator),
    analyzedPurchaseIds,
    excludedPurchaseIds,
    lotTheory,
  };
}

export const calculateAnalysis = analyzePosition;
