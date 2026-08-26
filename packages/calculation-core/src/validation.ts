import type {
  AnalysisInput,
  ISODate,
  PricePoint,
  Purchase,
  PurchaseDateValidationOptions,
  PurchaseValidationOptions,
  ValidationIssue,
} from './types.js';

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export class AnalysisInputError extends Error {
  readonly issues: readonly ValidationIssue[];

  constructor(issues: readonly ValidationIssue[]) {
    super(issues.map((issue) => issue.message).join(' '));
    this.name = 'AnalysisInputError';
    this.issues = issues;
  }
}

function issue(code: string, path: string, message: string): ValidationIssue {
  return { code, path, message };
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function isISODate(value: unknown): value is ISODate {
  if (typeof value !== 'string') return false;
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

export function compareISODates(left: ISODate, right: ISODate): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function validatePurchaseDate(
  date: string,
  options: PurchaseDateValidationOptions = {},
): ValidationIssue[] {
  if (!isISODate(date)) {
    return [issue('date.invalid', 'date', '매수일은 YYYY-MM-DD 형식의 유효한 날짜여야 합니다.')];
  }

  const issues: ValidationIssue[] = [];
  if (options.listedDate && isISODate(options.listedDate) && date < options.listedDate) {
    issues.push(issue('date.before-listed', 'date', '상품 상장일 이전 날짜는 입력할 수 없습니다.'));
  }
  if (options.today && isISODate(options.today) && date > options.today) {
    issues.push(issue('date.future', 'date', '미래 날짜는 입력할 수 없습니다.'));
  }
  if (options.availableDates) {
    const availableDates =
      options.availableDates instanceof Set
        ? options.availableDates
        : new Set<ISODate>(options.availableDates);
    if (!availableDates.has(date)) {
      issues.push(
        issue('date.price-unavailable', 'date', '해당 날짜의 공식 가격 데이터가 없습니다.'),
      );
    }
  }
  return issues;
}

export function validatePurchase(
  purchase: Purchase,
  options: PurchaseValidationOptions = {},
): ValidationIssue[] {
  const index = options.index ?? 0;
  const path = `purchases[${index}]`;
  const issues: ValidationIssue[] = [];

  if (typeof purchase.id !== 'string' || purchase.id.trim() === '') {
    issues.push(issue('purchase.id-required', `${path}.id`, '매수분 ID가 필요합니다.'));
  }

  for (const dateIssue of validatePurchaseDate(purchase.date, options)) {
    issues.push({ ...dateIssue, path: `${path}.date` });
  }

  if (!Number.isSafeInteger(purchase.priceWon) || purchase.priceWon < 1) {
    issues.push(
      issue('purchase.invalid-price', `${path}.priceWon`, '매수가는 1원 이상의 정수여야 합니다.'),
    );
  }
  if (!Number.isSafeInteger(purchase.quantity) || purchase.quantity < 1) {
    issues.push(
      issue('purchase.invalid-quantity', `${path}.quantity`, '수량은 1주 이상의 정수여야 합니다.'),
    );
  }

  return issues;
}

export function validatePriceSeries(
  series: readonly PricePoint[],
  path = 'series',
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const dates = new Set<ISODate>();

  series.forEach((point, index) => {
    const pointPath = `${path}[${index}]`;
    if (!isISODate(point.date)) {
      issues.push(
        issue('series.invalid-date', `${pointPath}.date`, '가격 기준일이 유효하지 않습니다.'),
      );
    } else if (dates.has(point.date)) {
      issues.push(
        issue('series.duplicate-date', `${pointPath}.date`, '가격 시계열에 중복 날짜가 있습니다.'),
      );
    } else {
      dates.add(point.date);
    }

    if (!Number.isFinite(point.close) || point.close <= 0) {
      issues.push(
        issue('series.invalid-close', `${pointPath}.close`, '종가는 0보다 큰 유한수여야 합니다.'),
      );
    }
  });

  return issues;
}

export function normalizePriceSeries(series: readonly PricePoint[]): PricePoint[] {
  const issues = validatePriceSeries(series);
  if (issues.length > 0) throw new AnalysisInputError(issues);
  return [...series].sort((left, right) => compareISODates(left.date, right.date));
}

export function validateAnalysisInput(input: AnalysisInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { product } = input;

  if (!product.code.trim()) {
    issues.push(issue('product.code-required', 'product.code', '상품 코드가 필요합니다.'));
  }
  if (!product.name.trim()) {
    issues.push(issue('product.name-required', 'product.name', '상품명이 필요합니다.'));
  }
  if (product.productType !== 'ETF' && product.productType !== 'ETN') {
    issues.push(
      issue('product.invalid-type', 'product.productType', '상품 유형이 유효하지 않습니다.'),
    );
  }
  if (!product.underlyingId.trim() || !product.underlyingName.trim()) {
    issues.push(
      issue('product.underlying-required', 'product.underlyingId', '기초자산 정보가 필요합니다.'),
    );
  }
  if (!Number.isFinite(product.leverage) || product.leverage === 0) {
    issues.push(
      issue(
        'product.invalid-leverage',
        'product.leverage',
        '상품 배수는 0이 아닌 유한수여야 합니다.',
      ),
    );
  }
  if (!['stock', 'spot-index', 'futures-index'].includes(product.underlyingType)) {
    issues.push(
      issue(
        'product.invalid-underlying-type',
        'product.underlyingType',
        '기초자산 유형이 유효하지 않습니다.',
      ),
    );
  }
  if (product.analysisCapability !== 'full' && product.analysisCapability !== 'actual-only') {
    issues.push(
      issue(
        'product.invalid-analysis-capability',
        'product.analysisCapability',
        '상품 분석 가능 상태가 유효하지 않습니다.',
      ),
    );
  }
  if (typeof product.active !== 'boolean') {
    issues.push(
      issue('product.invalid-active', 'product.active', '상품 활성 상태가 유효하지 않습니다.'),
    );
  }
  if (!isISODate(product.listedDate)) {
    issues.push(
      issue(
        'product.invalid-listed-date',
        'product.listedDate',
        '상품 상장일이 유효하지 않습니다.',
      ),
    );
  }

  if (input.purchases.length < 1 || input.purchases.length > 50) {
    issues.push(issue('purchases.count', 'purchases', '매수내역은 1개 이상 50개 이하여야 합니다.'));
  }

  const purchaseIds = new Set<string>();
  input.purchases.forEach((purchase, index) => {
    issues.push(...validatePurchase(purchase, { index, listedDate: product.listedDate }));
    if (purchaseIds.has(purchase.id)) {
      issues.push(
        issue('purchase.duplicate-id', `purchases[${index}].id`, '매수분 ID는 중복될 수 없습니다.'),
      );
    }
    purchaseIds.add(purchase.id);
  });

  if (!Number.isFinite(input.currentProductPrice) || input.currentProductPrice <= 0) {
    issues.push(
      issue(
        'current-price.invalid',
        'currentProductPrice',
        '현재 상품 가격은 0보다 큰 유한수여야 합니다.',
      ),
    );
  }
  issues.push(...validatePriceSeries(input.productSeries, 'productSeries'));
  issues.push(...validatePriceSeries(input.underlyingSeries, 'underlyingSeries'));

  return issues;
}

export function assertValidAnalysisInput(input: AnalysisInput): void {
  const issues = validateAnalysisInput(input);
  if (issues.length > 0) throw new AnalysisInputError(issues);
}
