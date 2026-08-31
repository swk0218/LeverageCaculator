import type { PurchaseDraft, SaleDraft, StoredCalculatorState } from './types';

export const STORAGE_KEY = 'yangbok-eumbok:calculator';
export const STORAGE_TTL_MS = 30 * 24 * 60 * 60 * 1_000;

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

const isSaleDraft = (value: unknown): value is SaleDraft => {
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

export const parseStoredState = (
  raw: string | null,
  now = Date.now(),
): StoredCalculatorState | null => {
  if (!raw) return null;

  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return null;
    const state = value as Record<string, unknown>;
    const sales = Array.isArray(state.sales) && state.sales.every(isSaleDraft) ? state.sales : [];
    const salesAreValid =
      state.sales === undefined ||
      (Array.isArray(state.sales) && state.sales.length <= 50 && state.sales.every(isSaleDraft));
    if (
      state.version !== 2 ||
      state.persistInputs !== true ||
      typeof state.savedAt !== 'number' ||
      !Number.isSafeInteger(state.savedAt) ||
      typeof state.expiresAt !== 'number' ||
      !Number.isSafeInteger(state.expiresAt) ||
      state.savedAt <= 0 ||
      state.expiresAt !== state.savedAt + STORAGE_TTL_MS ||
      state.expiresAt <= now ||
      typeof state.productCode !== 'string' ||
      !PRODUCT_CODE.test(state.productCode) ||
      !Array.isArray(state.purchases) ||
      state.purchases.length < 1 ||
      state.purchases.length > 50 ||
      !state.purchases.every(isDraft) ||
      !salesAreValid ||
      new Set([...state.purchases.map((purchase) => purchase.id), ...sales.map((sale) => sale.id)])
        .size !==
        state.purchases.length + sales.length ||
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
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = parseStoredState(raw);
    if (raw && !parsed) localStorage.removeItem(STORAGE_KEY);
    return parsed;
  } catch {
    return null;
  }
};

export const saveState = (state: Omit<StoredCalculatorState, 'savedAt' | 'expiresAt'>): void => {
  try {
    const savedAt = Date.now();
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...state, savedAt, expiresAt: savedAt + STORAGE_TTL_MS }),
    );
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
