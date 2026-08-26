import { normalizeZero } from './calculations.js';

const WON_FORMATTER = new Intl.NumberFormat('ko-KR', {
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

function roundForDisplay(value: number, fractionDigits: number): number {
  const zeroThreshold = 0.5 * 10 ** -fractionDigits;
  if (Math.abs(value) < zeroThreshold) return 0;
  const factor = 10 ** fractionDigits;
  const roundedMagnitude = Math.round((Math.abs(value) + Number.EPSILON * 10) * factor) / factor;
  return normalizeZero(Math.sign(value) * roundedMagnitude);
}

function formatFiniteNumber(
  value: number,
  minimumFractionDigits: number,
  maximumFractionDigits: number,
): string {
  const normalized = roundForDisplay(value, maximumFractionDigits);
  return new Intl.NumberFormat('ko-KR', {
    minimumFractionDigits,
    maximumFractionDigits,
    useGrouping: true,
  }).format(normalized);
}

function withPositiveSign(formatted: string, value: number, showPositiveSign: boolean): string {
  return showPositiveSign && value > 0 ? `+${formatted}` : formatted;
}

export function formatWon(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const rounded = normalizeZero(Math.round(value));
  return `${WON_FORMATTER.format(rounded)}원`;
}

export function formatSignedWon(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const rounded = normalizeZero(Math.round(value));
  const formatted = `${WON_FORMATTER.format(rounded)}원`;
  return rounded > 0 ? `+${formatted}` : formatted;
}

export const formatAveragePriceWon = formatWon;

export function formatQuantity(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return `${WON_FORMATTER.format(normalizeZero(Math.round(value)))}주`;
}

export function formatPercent(rate: number, fractionDigits = 1, showPositiveSign = true): string {
  if (!Number.isFinite(rate)) return '—';
  const percentage = roundForDisplay(rate * 100, fractionDigits);
  const formatted = formatFiniteNumber(percentage, fractionDigits, fractionDigits);
  return `${withPositiveSign(formatted, percentage, showPositiveSign)}%`;
}

export function formatDetailedPercent(rate: number, maximumFractionDigits = 2): string {
  if (!Number.isFinite(rate)) return '—';
  const percentage = roundForDisplay(rate * 100, maximumFractionDigits);
  const formatted = formatFiniteNumber(percentage, 0, maximumFractionDigits);
  return `${withPositiveSign(formatted, percentage, true)}%`;
}

export function formatPercentagePoints(rate: number, fractionDigits = 1): string {
  if (!Number.isFinite(rate)) return '—';
  const percentagePoints = roundForDisplay(rate * 100, fractionDigits);
  const formatted = formatFiniteNumber(percentagePoints, fractionDigits, fractionDigits);
  return `${withPositiveSign(formatted, percentagePoints, true)}%p`;
}
