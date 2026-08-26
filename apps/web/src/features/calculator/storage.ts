import type { PurchaseDraft, StoredCalculatorState } from './types';

export const STORAGE_KEY = 'yangbok-eumbok:calculator';

const ISO_DATE_OR_EMPTY = /^(?:|\d{4}-\d{2}-\d{2})$/u;
const PRODUCT_CODE = /^[0-9A-Z]{6}$/u;

const isSafeFormattedInteger = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  if (value === '') return true;
  if (!/^\d{1,3}(?:,\d{3})*$/u.test(value)) return false;
  const digits = value.replaceAll(',', '');
  if (digits.length > 16 || !Number.isSafeInteger(Number(digits))) return false;
  return digits.replace(/^0+(?=\d)/u, '').replace(/\B(?=(\d{3})+(?!\d))/gu, ',') === value;
};

const isDraft = (value: unknown): value is PurchaseDraft => {
  if (!value || typeof value !== 'object') return false;
  const draft = value as Record<string, unknown>;
  return (
    typeof draft.id === 'string' &&
    draft.id.length > 0 &&
    draft.id.length <= 128 &&
    typeof draft.date === 'string' &&
    ISO_DATE_OR_EMPTY.test(draft.date) &&
    isSafeFormattedInteger(draft.price) &&
    isSafeFormattedInteger(draft.quantity)
  );
};

export const parseStoredState = (raw: string | null): StoredCalculatorState | null => {
  if (!raw) return null;

  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return null;
    const state = value as Record<string, unknown>;
    if (
      state.version !== 1 ||
      typeof state.productCode !== 'string' ||
      !PRODUCT_CODE.test(state.productCode) ||
      !Array.isArray(state.purchases) ||
      state.purchases.length < 1 ||
      state.purchases.length > 50 ||
      !state.purchases.every(isDraft) ||
      new Set(state.purchases.map((purchase) => purchase.id)).size !== state.purchases.length ||
      !(state.manualCurrentPrice === null || isSafeFormattedInteger(state.manualCurrentPrice))
    ) {
      return null;
    }
    return state as unknown as StoredCalculatorState;
  } catch {
    return null;
  }
};

export const loadState = (): StoredCalculatorState | null => {
  try {
    return parseStoredState(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
};

export const saveState = (state: StoredCalculatorState): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // A blocked or full localStorage must not block calculation.
  }
};

export const clearState = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // The visible reset still succeeds even if storage is unavailable.
  }
};
