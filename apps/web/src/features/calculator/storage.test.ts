import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  clearState,
  loadState,
  parseStoredState,
  saveState,
  STORAGE_KEY,
  STORAGE_TTL_MS,
} from './storage';

const validPurchase = { id: 'lot-1', date: '2026-08-17', price: '12,000', quantity: '10' };
const validSale = { id: 'sale-1', date: '2026-08-20', price: '14,000', quantity: '3' };

const now = Date.UTC(2026, 7, 26);
const saveableState = {
  version: 2 as const,
  persistInputs: true as const,
  productCode: 'F2UP01',
  purchases: [validPurchase],
  manualCurrentPrice: null,
};
const validState = {
  ...saveableState,
  savedAt: now,
  expiresAt: now + STORAGE_TTL_MS,
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('calculator local storage boundary', () => {
  it('accepts only the versioned calculator shape', () => {
    expect(parseStoredState(JSON.stringify(validState), now)).toEqual(validState);
    expect(parseStoredState(JSON.stringify({ ...validState, sales: [validSale] }), now)).toEqual({
      ...validState,
      sales: [validSale],
    });
    expect(parseStoredState('{')).toBeNull();
    expect(parseStoredState(JSON.stringify({ ...validState, version: 1 }), now)).toBeNull();
    expect(
      parseStoredState(JSON.stringify({ ...validState, persistInputs: false }), now),
    ).toBeNull();
    expect(parseStoredState(JSON.stringify(validState), validState.expiresAt)).toBeNull();
    expect(
      parseStoredState(
        JSON.stringify({
          ...validState,
          purchases: [validPurchase, validPurchase],
        }),
        now,
      ),
    ).toBeNull();
    expect(
      parseStoredState(
        JSON.stringify({
          ...validState,
          purchases: [{ ...validPurchase, price: '9,999,999,999,999,999,999' }],
        }),
        now,
      ),
    ).toBeNull();
    expect(
      parseStoredState(
        JSON.stringify({
          ...validState,
          purchases: Array.from({ length: 51 }, () => validPurchase),
        }),
        now,
      ),
    ).toBeNull();
    expect(
      parseStoredState(
        JSON.stringify({ ...validState, sales: [{ ...validSale, id: validPurchase.id }] }),
        now,
      ),
    ).toBeNull();
  });

  it('treats blocked storage as unavailable instead of crashing the calculator', () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => {
        throw new DOMException('blocked');
      }),
      setItem: vi.fn(() => {
        throw new DOMException('blocked');
      }),
      removeItem: vi.fn(() => {
        throw new DOMException('blocked');
      }),
    });

    expect(loadState()).toBeNull();
    expect(() => saveState(saveableState)).not.toThrow();
    expect(() => clearState()).not.toThrow();
  });

  it('uses the private calculator key and never serializes outside local storage', () => {
    const setItem = vi.fn();
    vi.stubGlobal('localStorage', { getItem: vi.fn(), setItem, removeItem: vi.fn() });
    vi.spyOn(Date, 'now').mockReturnValue(now);

    saveState(saveableState);

    expect(setItem).toHaveBeenCalledWith(STORAGE_KEY, JSON.stringify(validState));
  });

  it('removes expired or legacy state instead of restoring it', () => {
    const removeItem = vi.fn();
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => JSON.stringify({ ...validState, expiresAt: now - 1 })),
      setItem: vi.fn(),
      removeItem,
    });
    vi.spyOn(Date, 'now').mockReturnValue(now);

    expect(loadState()).toBeNull();
    expect(removeItem).toHaveBeenCalledWith(STORAGE_KEY);
  });
});
