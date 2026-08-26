import { describe, expect, it, vi } from 'vitest';

import {
  FSC_API_SPECS,
  FscEtfItemSchema,
  FscProviderError,
  FixtureMarketDataProvider,
  LiveFscMarketDataProvider,
  PRODUCT_MASTER,
  PriceSeriesSchema,
  ProductDataBundleSchema,
  SANITIZED_FSC_AUTH_ERROR,
  SANITIZED_FSC_EMPTY_PAGE,
  SANITIZED_FSC_ETF_PAGE,
  SANITIZED_FSC_MALFORMED_PAGE,
  assessStaleness,
  fixtureCatalog,
  getFixtureProductData,
  parseFscPage,
  toProduct,
} from './index';

const RETRYABLE_FSC_ENVELOPE = {
  response: {
    header: { resultCode: '22', resultMsg: 'LIMITED NUMBER OF SERVICE REQUESTS EXCEEDS ERROR.' },
  },
} as const;

describe('runtime contracts', () => {
  it('rejects duplicate or unsorted dates', () => {
    const result = PriceSeriesSchema.safeParse([
      { date: '2026-08-25', close: 100 },
      { date: '2026-08-25', close: 101 },
    ]);
    expect(result.success).toBe(false);
  });

  it('validates every browser-facing fixture bundle', () => {
    for (const fixture of Object.values(fixtureCatalog)) {
      expect(ProductDataBundleSchema.parse(fixture)).toEqual(fixture);
    }
    expect(getFixtureProductData('F2UP01')?.product.analysisCapability).toBe('full');
    expect(getFixtureProductData('F2DN01')?.product.leverage).toBe(-2);
    expect(getFixtureProductData('FPOS01')?.product.analysisCapability).toBe('full');
    expect(getFixtureProductData('FACT01')?.underlyingSeries).toEqual([]);
  });

  it('includes deterministic positive and negative compound-effect paths', () => {
    const compoundEffect = (code: string): number => {
      const fixture = getFixtureProductData(code);
      expect(fixture).toBeDefined();
      const prices = fixture!.underlyingSeries;
      const first = prices[0]!;
      const last = prices.at(-1)!;
      const simpleReturn = fixture!.product.leverage * (last.close / first.close - 1);
      const dailyReturn =
        prices.slice(1).reduce((factor, point, index) => {
          const previous = prices[index]!;
          return factor * (1 + fixture!.product.leverage * (point.close / previous.close - 1));
        }, 1) - 1;
      return dailyReturn - simpleReturn;
    };

    expect(compoundEffect('FPOS01')).toBeCloseTo(0.02, 12);
    expect(compoundEffect('F2UP01')).toBeLessThan(0);
  });

  it('covers fresh, stale, mismatch and actual-only states', () => {
    expect(getFixtureProductData('F2UP01')?.stale.isStale).toBe(false);
    expect(getFixtureProductData('FSTL01')?.stale.isStale).toBe(true);
    expect(getFixtureProductData('FMIS01')?.latest.product.date).not.toBe(
      getFixtureProductData('FMIS01')?.latest.underlying?.date,
    );
    expect(getFixtureProductData('FACT01')?.product.analysisCapability).toBe('actual-only');
  });
});

describe('stale detection', () => {
  it('counts weekdays without UTC date drift', () => {
    expect(assessStaleness('2026-08-21', '2026-08-24')).toMatchObject({
      businessDaysBehind: 1,
      isStale: false,
    });
    expect(assessStaleness('2026-08-20', '2026-08-24')).toMatchObject({
      businessDaysBehind: 2,
      isStale: true,
    });
  });
});

describe('verified product master', () => {
  it('contains only evidence-backed production entries and no fixture placeholders', () => {
    expect(PRODUCT_MASTER).toHaveLength(18);
    expect(new Set(PRODUCT_MASTER.map(({ code }) => code)).size).toBe(PRODUCT_MASTER.length);
    for (const entry of PRODUCT_MASTER) {
      expect(entry.code.startsWith('F')).toBe(false);
      expect(entry.verification.status).toBe('verified');
      expect(entry.verification.evidenceUrl).toMatch(/^https:\/\//);
      expect(entry.analysisCapability).toBe('actual-only');
      expect(toProduct(entry)).not.toHaveProperty('verification');
    }
  });
});

describe('official FSC response parsing', () => {
  it('parses the official field layout and normalizes singleton/array items', () => {
    const page = parseFscPage(SANITIZED_FSC_ETF_PAGE, FscEtfItemSchema);
    expect(page.totalCount).toBe(2);
    expect(page.items[0]).toMatchObject({ basDt: '20260824', srtnCd: 'F2UP01', clpr: 10_566 });
  });

  it('uses totalCount zero as the authoritative empty response', () => {
    expect(parseFscPage(SANITIZED_FSC_EMPTY_PAGE, FscEtfItemSchema).items).toEqual([]);
  });

  it('fails closed on malformed and authentication responses', () => {
    expect(() => parseFscPage(SANITIZED_FSC_MALFORMED_PAGE, FscEtfItemSchema)).toThrow();
    expect(() => parseFscPage(SANITIZED_FSC_AUTH_ERROR, FscEtfItemSchema)).toThrow(
      FscProviderError,
    );
  });
});

describe('providers', () => {
  it('returns range-filtered fixture data', async () => {
    const provider = new FixtureMarketDataProvider();
    const result = await provider.fetchProductData(getFixtureProductData('F2UP01')!.product, {
      from: '2026-08-24',
      to: '2026-08-25',
    });
    expect(result.productSeries.prices).toHaveLength(2);
    expect(result.underlyingSeries?.prices).toHaveLength(2);
  });

  it('uses the documented ETF operation and exclusive endBasDt while filtering exact codes', async () => {
    const fetchMock = vi.fn((input: string | URL | Request) => {
      const url = new URL(
        typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
      );
      expect(url.pathname).toContain(`/${FSC_API_SPECS.securitiesProduct.operations.ETF}`);
      expect(url.searchParams.get('likeSrtnCd')).toBe('0195R0');
      expect(url.searchParams.get('beginBasDt')).toBe('20260824');
      expect(url.searchParams.get('endBasDt')).toBe('20260826');
      expect(url.searchParams.has('priceWon')).toBe(false);
      return Promise.resolve(
        new Response(
          JSON.stringify({
            response: {
              header: { resultCode: '00', resultMsg: 'NORMAL SERVICE.' },
              body: {
                numOfRows: 1000,
                pageNo: 1,
                totalCount: 1,
                items: {
                  item: {
                    basDt: '20260825',
                    srtnCd: '0195R0',
                    itmsNm: 'TIGER 삼성전자단일종목레버리지',
                    clpr: '12345',
                  },
                },
              },
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );
    });
    const provider = new LiveFscMarketDataProvider({
      serviceKey: 'not-a-real-key',
      fetch: fetchMock,
    });
    const product = toProduct(PRODUCT_MASTER.find(({ code }) => code === '0195R0')!);
    const result = await provider.fetchProductData(product, {
      from: '2026-08-24',
      to: '2026-08-25',
    });
    expect(result.productSeries.prices).toEqual([{ date: '2026-08-25', close: 12_345 }]);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('retries transient HTTP errors with a bounded retry count', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('busy', { status: 503 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify(SANITIZED_FSC_EMPTY_PAGE), { status: 200 }),
      );
    const provider = new LiveFscMarketDataProvider({
      serviceKey: 'secret-value',
      fetch: fetchMock,
      maxRetries: 1,
      sleep: () => Promise.resolve(),
    });
    const product = toProduct(PRODUCT_MASTER[0]!);
    const result = await provider.fetchProductData(product, {
      from: '2026-08-24',
      to: '2026-08-25',
    });
    expect(result.productSeries.prices).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries a retryable HTTP-200 FSC envelope and then succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(RETRYABLE_FSC_ENVELOPE), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify(SANITIZED_FSC_EMPTY_PAGE), { status: 200 }),
      );
    const sleep = vi.fn(() => Promise.resolve());
    const provider = new LiveFscMarketDataProvider({
      serviceKey: 'secret-value',
      fetch: fetchMock,
      maxRetries: 1,
      sleep,
    });

    const result = await provider.fetchProductData(toProduct(PRODUCT_MASTER[0]!), {
      from: '2026-08-24',
      to: '2026-08-25',
    });

    expect(result.productSeries.prices).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledExactlyOnceWith(100);
  });

  it('stops after the bounded retries for a persistent retryable FSC envelope', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify(RETRYABLE_FSC_ENVELOPE), { status: 200 })),
    );
    const sleep = vi.fn(() => Promise.resolve());
    const provider = new LiveFscMarketDataProvider({
      serviceKey: 'secret-value',
      fetch: fetchMock,
      maxRetries: 2,
      sleep,
    });

    await expect(
      provider.fetchProductData(toProduct(PRODUCT_MASTER[0]!), {
        from: '2026-08-24',
        to: '2026-08-25',
      }),
    ).rejects.toMatchObject({ code: '22', retryable: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenNthCalledWith(1, 100);
    expect(sleep).toHaveBeenNthCalledWith(2, 200);
  });

  it('aborts an upstream request at the configured timeout', async () => {
    const provider = new LiveFscMarketDataProvider({
      serviceKey: 'secret-value',
      timeoutMs: 1,
      maxRetries: 0,
      fetch: (input, init) =>
        new Promise((resolve, reject) => {
          void input;
          void resolve;
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'));
          });
        }),
    });
    await expect(
      provider.fetchProductData(toProduct(PRODUCT_MASTER[0]!), {
        from: '2026-08-24',
        to: '2026-08-25',
      }),
    ).rejects.toMatchObject({ code: 'UPSTREAM_TIMEOUT' });
  });

  it('retries when the response body aborts after headers arrive', async () => {
    const fetchMock = vi.fn((_input: string | URL | Request, init?: RequestInit) =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          new Promise<never>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
              reject(new DOMException('aborted body', 'AbortError'));
            });
          }),
      } as unknown as Response),
    );
    const sleep = vi.fn(() => Promise.resolve());
    const provider = new LiveFscMarketDataProvider({
      serviceKey: 'secret-value',
      timeoutMs: 1,
      maxRetries: 1,
      fetch: fetchMock,
      sleep,
    });

    await expect(
      provider.fetchProductData(toProduct(PRODUCT_MASTER[0]!), {
        from: '2026-08-24',
        to: '2026-08-25',
      }),
    ).rejects.toMatchObject({ code: 'UPSTREAM_TIMEOUT', retryable: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledExactlyOnceWith(100);
  });

  it('never leaks the service key through provider errors', async () => {
    const provider = new LiveFscMarketDataProvider({
      serviceKey: 'top-secret-key',
      fetch: () => Promise.resolve(new Response('denied', { status: 403 })),
      maxRetries: 0,
    });
    await expect(
      provider.fetchProductData(toProduct(PRODUCT_MASTER[0]!), {
        from: '2026-08-24',
        to: '2026-08-25',
      }),
    ).rejects.not.toThrow(/top-secret-key/);
  });
});
