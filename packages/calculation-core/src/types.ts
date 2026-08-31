export type ISODate = string;

export interface Purchase {
  id: string;
  date: ISODate;
  priceWon: number;
  quantity: number;
}

export interface Sale {
  id: string;
  date: ISODate;
  priceWon: number;
  quantity: number;
}

export interface Product {
  code: string;
  name: string;
  productType: 'ETF' | 'ETN';
  leverage: number;
  underlyingId: string;
  underlyingName: string;
  underlyingType: 'stock' | 'spot-index' | 'futures-index';
  /** Whether the analysis series is the direct stock basis or a clearly labelled stock proxy. */
  analysisBasis?: 'underlying-stock' | 'reference-stock-proxy';
  /** Unlevered index whose daily return defines the product's target multiple. */
  baseIndexName?: string;
  baseIndexType?: 'price-return-index' | 'futures-index' | 'total-return-index';
  listedDate: ISODate;
  analysisCapability: 'full' | 'actual-only';
  active: boolean;
}

export interface PricePoint {
  date: ISODate;
  close: number;
}

export interface AnalysisInput {
  product: Product;
  purchases: Purchase[];
  sales?: Sale[];
  currentProductPrice: number;
  productSeries: PricePoint[];
  underlyingSeries: PricePoint[];
}

export interface TransactionAccounting {
  totalPurchaseCostWon: number;
  totalSaleProceedsWon: number;
  soldQuantity: number;
  remainingQuantity: number;
  remainingCostWon: number;
  remainingAveragePriceWon: number;
  realizedPnlWon: number;
}

export interface PurchaseSummary {
  totalCostWon: number;
  totalQuantity: number;
  averagePriceWon: number;
}

export interface ActualPerformance extends PurchaseSummary {
  currentValueWon: number;
  actualPnlWon: number;
  actualReturn: number;
  totalSaleProceedsWon: number;
  soldQuantity: number;
  remainingCostWon: number;
  realizedPnlWon: number;
  unrealizedPnlWon: number;
}

export interface BreakEvenScenario {
  tradingDays: number;
  isPossible: boolean;
  dailyUnderlyingReturn?: number;
  cumulativeUnderlyingReturn?: number;
  verificationProductMultiplier?: number;
  targetUnderlyingPrice?: number;
  reason?: string;
}

export interface LotTheoryResult {
  purchaseId: string;
  purchaseDate: ISODate;
  analysisDate: ISODate;
  saleId?: string;
  quantity?: number;
  principalWon: number;
  startUnderlyingPrice: number;
  endUnderlyingPrice: number;
  underlyingPeriodReturn: number;
  simpleTheoreticalReturn: number;
  dailyTheoreticalReturn: number;
  simpleTheoreticalPnlWon: number;
  dailyTheoreticalPnlWon: number;
  compoundEffectWon: number;
}

export type AnalysisCoverage = 'full' | 'partial' | 'unavailable';

export interface AnalysisResult extends ActualPerformance {
  productBreakEvenReturn: number;
  breakEvenScenarios: BreakEvenScenario[];
  simpleTheoreticalPnlWon?: number;
  dailyTheoreticalPnlWon?: number;
  compoundEffectWon?: number;
  compoundEffectRate?: number;
  theoreticalActualGapWon?: number;
  analysisDate?: ISODate;
  warnings: string[];
  analysisCoverage: AnalysisCoverage;
  analyzedCostWon?: number;
  analyzedQuantity?: number;
  analysisCoverageRate?: number;
  simpleTheoreticalReturn?: number;
  dailyTheoreticalReturn?: number;
  officialAnalysisPnlWon?: number;
  officialAnalysisReturn?: number;
  theoreticalActualGapRate?: number;
  analyzedPurchaseIds: string[];
  excludedPurchaseIds: string[];
  lotTheory: LotTheoryResult[];
}

export interface ValidationIssue {
  code: string;
  path: string;
  message: string;
}

export interface PurchaseDateValidationOptions {
  listedDate?: ISODate;
  today?: ISODate;
  availableDates?: ReadonlySet<ISODate> | readonly ISODate[];
}

export interface PurchaseValidationOptions extends PurchaseDateValidationOptions {
  index?: number;
}

export interface SaleValidationOptions extends PurchaseDateValidationOptions {
  index?: number;
}
