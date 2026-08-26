import { afterEach, describe, expect, it, vi } from 'vitest';

import { clearState, loadState, parseStoredState, saveState, STORAGE_KEY } from './storage';

const validPurchase = { id: 'lot-1', date: '2026-08-17', price: '12,000', quantity: '10' };

const validState = {
  version: 1 as const,
  productCode: 'F2UP01',
  purchases: [validPurchase],
  manualCurrentPrice: null,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('calculator local storage boundary', () => {
  it('accepts only the versioned calculator shape', () => {
    expect(parseStoredState(JSON.stringify(validState))).toEqual(validState);
    expect(parseStoredState('{')).toBeNull();
    expect(parseStoredState(JSON.stringify({ ...validState, version: 2 }))).toBeNull();
    expect(
      parseStoredState(
        JSON.stringify({
          ...validState,
          purchases: [validPurchase, validPurchase],
        }),
      ),
    ).toBeNull();
    expect(
      parseStoredState(
        JSON.stringify({
          ...validState,
          purchases: [{ ...validPurchase, price: '9,999,999,999,999,999,999' }],
        }),
      ),
    ).toBeNull();
    expect(
      parseStoredState(
        JSON.stringify({
          ...validState,
          purchases: Array.from({ length: 51 }, () => validPurchase),
        }),
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
    expect(() => saveState(validState)).not.toThrow();
    expect(() => clearState()).not.toThrow();
  });

  it('uses the private calculator key and never serializes outside local storage', () => {
    const setItem = vi.fn();
    vi.stubGlobal('localStorage', { getItem: vi.fn(), setItem, removeItem: vi.fn() });

    saveState(validState);

    expect(setItem).toHaveBeenCalledWith(STORAGE_KEY, JSON.stringify(validState));
  });
});
