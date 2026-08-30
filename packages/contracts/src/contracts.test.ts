import { describe, expect, it, vi } from 'vitest';

import {
  AnalysisDataResponseSchema,
  FSC_API_SPECS,
  FscEtfItemSchema,
  FscProviderError,
  FixtureMarketDataProvider,
  HealthResponseSchema,
  LiveFscMarketDataProvider,
  PRODUCT_MASTER,
  PriceSeriesSchema,
  ProductSchema,
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
    header: { resultCode: '23', resultMsg: 'SERVICE REQUESTS EXCEEDS ERROR.' },
  },
} as const;

const DAILY_QUOTA_FSC_ENVELOPE = {
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

  it('requires base-index name and type together', () => {
    const product = toProduct(PRODUCT_MASTER[0]!);
    const missingType = { ...product };
    delete missingType.baseIndexType;
    expect(ProductSchema.safeParse(missingType).success).toBe(false);
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

  it('accepts every intentional fixture state as a complete analysis response', () => {
    for (const data of fixtureCatalog) {
      expect(
        AnalysisDataResponseSchema.parse({
          data,
          meta: { mode: 'fixture', generatedAt: '2026-08-26T05:30:00.000Z' },
        }).data,
      ).toEqual(data);
    }
  });

  it('rejects a latest product value that is not the product-series tail', () => {
    const data = getFixtureProductData('F2UP01')!;
    const result = AnalysisDataResponseSchema.safeParse({
      data: {
        ...data,
        latest: {
          ...data.latest,
          product: { ...data.latest.product, close: data.latest.product.close + 1 },
        },
      },
      meta: { mode: 'fixture', generatedAt: '2026-08-26T05:30:00.000Z' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects a latest underlying value that is not the underlying-series tail', () => {
    const data = getFixtureProductData('F2UP01')!;
    const result = AnalysisDataResponseSchema.safeParse({
      data: {
        ...data,
        latest: {
          ...data.latest,
          underlying: {
            ...data.latest.underlying!,
            close: data.latest.underlying!.close + 1,
          },
        },
      },
      meta: { mode: 'fixture', generatedAt: '2026-08-26T05:30:00.000Z' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects freshness metadata whose as-of date differs from the latest product date', () => {
    const data = getFixtureProductData('F2UP01')!;
    const result = AnalysisDataResponseSchema.safeParse({
      data: { ...data, stale: { ...data.stale, asOf: '2026-08-24' } },
      meta: { mode: 'fixture', generatedAt: '2026-08-26T05:30:00.000Z' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects an analysis date that is not the last date common to both series', () => {
    const data = getFixtureProductData('FMIS01')!;
    const result = AnalysisDataResponseSchema.safeParse({
      data: { ...data, latest: { ...data.latest, analysisDate: '2026-08-25' } },
      meta: { mode: 'fixture', generatedAt: '2026-08-26T05:30:00.000Z' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects an actual-only response containing an unverified underlying series', () => {
    const data = getFixtureProductData('FACT01')!;
    const underlying = { date: '2026-08-25' as const, close: 100 };
    const result = AnalysisDataResponseSchema.safeParse({
      data: {
        ...data,
        underlyingSeries: [underlying],
        latest: { ...data.latest, underlying, analysisDate: underlying.date },
      },
      meta: { mode: 'fixture', generatedAt: '2026-08-26T05:30:00.000Z' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects a full-analysis response without an underlying series', () => {
    const data = getFixtureProductData('F2UP01')!;
    const result = AnalysisDataResponseSchema.safeParse({
      data: {
        ...data,
        underlyingSeries: [],
        latest: { product: data.latest.product },
      },
      meta: { mode: 'fixture', generatedAt: '2026-08-26T05:30:00.000Z' },
    });
    expect(result.success).toBe(false);
  });

  it('accepts and validates the additive health coverage and sync fields', () => {
    const health = {
      status: 'degraded',
      mode: 'live',
      database: 'ok',
      latestTradeDate: '2026-08-25',
      stale: true,
      checkedAt: '2026-08-26T06:00:00.000Z',
      coverage: {
        activeProducts: 3,
        freshProducts: 1,
        staleProducts: 1,
        missingProducts: 1,
        complete: false,
      },
      lastSync: {
        state: 'partial',
        startedAt: '2026-08-26T05:30:00.000Z',
        finishedAt: '2026-08-26T05:30:01.000Z',
        latestTradeDate: '2026-08-25',
        recordCount: 4,
      },
    } as const;

    expect(HealthResponseSchema.parse(health)).toEqual(health);
    expect(
      HealthResponseSchema.safeParse({
        ...health,
        coverage: { ...health.coverage, activeProducts: 4 },
      }).success,
    ).toBe(false);
    expect(
      HealthResponseSchema.safeParse({
        ...health,
        lastSync: { ...health.lastSync, state: 'unknown' },
      }).success,
    ).toBe(false);
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

  it('describes fixture staleness as weekday-based rather than exchange-business-day based', () => {
    expect(getFixtureProductData('FSTL01')?.warnings).toContain(
      '공식 가격 기준일이 평일 기준 2일 이상 지연되었습니다.',
    );
    expect(getFixtureProductData('FSTL01')?.warnings.join(' ')).not.toContain('영업일');
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
      expect(entry.verification.liveUnderlyingSeriesVerified).toBe(false);
      expect(entry.analysisCapability).toBe('full');
      expect(entry.underlyingType).toBe('stock');
      expect(['005930', '000660']).toContain(entry.underlyingId);
      expect(entry.analysisBasis).toMatch(/^(underlying-stock|reference-stock-proxy)$/);
      expect(entry.baseIndexName).toMatch(/^KRX /);
      expect(entry.baseIndexType).toMatch(
        /^(price-return-index|futures-index|total-return-index)$/,
      );
      expect(toProduct(entry)).not.toHaveProperty('verification');
      expect(toProduct(entry).analysisBasis).toBe(entry.analysisBasis);
      expect(toProduct(entry).baseIndexName).toBe(entry.baseIndexName);
      expect(toProduct(entry).baseIndexType).toBe(entry.baseIndexType);
    }
    expect(
      PRODUCT_MASTER.filter(({ analysisBasis }) => analysisBasis === 'underlying-stock'),
    ).toHaveLength(10);
    expect(
      PRODUCT_MASTER.filter(({ analysisBasis }) => analysisBasis === 'reference-stock-proxy'),
    ).toHaveLength(8);
    expect(
      PRODUCT_MASTER.filter(({ baseIndexType }) => baseIndexType === 'futures-index'),
    ).toHaveLength(6);
    expect(
      PRODUCT_MASTER.filter(({ baseIndexType }) => baseIndexType === 'total-return-index'),
    ).toHaveLength(2);
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
      expect(url.searchParams.get('beginBasDt')).toBe('20260824');
      expect(url.searchParams.get('endBasDt')).toBe('20260826');
      expect(url.searchParams.has('priceWon')).toBe(false);
      const isProduct = url.pathname.endsWith(`/${FSC_API_SPECS.securitiesProduct.operations.ETF}`);
      expect(url.searchParams.get('likeSrtnCd')).toBe(isProduct ? '0195R0' : '005930');
      const item = isProduct
        ? {
            basDt: '20260825',
            srtnCd: '0195R0',
            itmsNm: 'TIGER 삼성전자단일종목레버리지',
            clpr: '12345',
          }
        : {
            basDt: '20260825',
            srtnCd: '005930',
            itmsNm: '삼성전자',
            clpr: '74200',
          };
      return Promise.resolve(
        new Response(
          JSON.stringify({
            response: {
              header: { resultCode: '00', resultMsg: 'NORMAL SERVICE.' },
              body: {
                numOfRows: 1000,
                pageNo: 1,
                totalCount: 1,
                items: { item },
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
    expect(result.underlyingSeries?.prices).toEqual([{ date: '2026-08-25', close: 74_200 }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('deduplicates the same official stock series across production products', async () => {
    const fetchMock = vi.fn((input: string | URL | Request) => {
      const url = new URL(
        typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
      );
      const requestedCode = url.searchParams.get('likeSrtnCd');
      const isUnderlying = requestedCode === '005930';
      const item = isUnderlying
        ? { basDt: '20260825', srtnCd: '005930', itmsNm: '삼성전자', clpr: '74200' }
        : {
            basDt: '20260825',
            srtnCd: requestedCode,
            itmsNm: '삼성전자 레버리지 상품',
            clpr: '12345',
          };
      return Promise.resolve(
        new Response(
          JSON.stringify({
            response: {
              header: { resultCode: '00', resultMsg: 'NORMAL SERVICE.' },
              body: {
                numOfRows: 1000,
                pageNo: 1,
                totalCount: 1,
                items: { item },
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
    const range = { from: '2026-08-24' as const, to: '2026-08-25' as const };
    const first = toProduct(PRODUCT_MASTER.find(({ code }) => code === '0193W0')!);
    const second = toProduct(PRODUCT_MASTER.find(({ code }) => code === '0195R0')!);

    const [firstResult, secondResult] = await Promise.all([
      provider.fetchProductData(first, range),
      provider.fetchProductData(second, range),
    ]);

    expect(firstResult.underlyingSeries?.asset.symbol).toBe('005930');
    expect(secondResult.underlyingSeries?.asset.symbol).toBe('005930');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(
      fetchMock.mock.calls.filter(([input]) => {
        const url = new URL(
          typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
        );
        return url.searchParams.get('likeSrtnCd') === '005930';
      }),
    ).toHaveLength(1);
  });

  it('fails closed when a full-analysis stock series is empty', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            response: {
              header: { resultCode: '00', resultMsg: 'NORMAL SERVICE.' },
              body: {
                numOfRows: 1,
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
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(SANITIZED_FSC_EMPTY_PAGE), { status: 200 }),
      );
    const provider = new LiveFscMarketDataProvider({
      serviceKey: 'not-a-real-key',
      fetch: fetchMock,
    });
    const product = toProduct(PRODUCT_MASTER.find(({ code }) => code === '0195R0')!);

    await expect(
      provider.fetchProductData(product, { from: '2026-08-24', to: '2026-08-25' }),
    ).rejects.toMatchObject({ code: 'UNDERLYING_SERIES_EMPTY', retryable: false });
  });

  it('fails closed when an official stock filter returns another identity', async () => {
    const fetchMock = vi.fn((input: string | URL | Request) => {
      const url = new URL(
        typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
      );
      const isProduct = url.pathname.endsWith('/getETFPriceInfo');
      const item = isProduct
        ? {
            basDt: '20260825',
            srtnCd: '0195R0',
            itmsNm: 'TIGER 삼성전자단일종목레버리지',
            clpr: '12345',
          }
        : { basDt: '20260825', srtnCd: '005935', itmsNm: '삼성전자우', clpr: '62100' };
      return Promise.resolve(
        new Response(
          JSON.stringify({
            response: {
              header: { resultCode: '00', resultMsg: 'NORMAL SERVICE.' },
              body: {
                numOfRows: 1,
                pageNo: 1,
                totalCount: 1,
                items: { item },
              },
            },
          }),
          { status: 200 },
        ),
      );
    });
    const provider = new LiveFscMarketDataProvider({
      serviceKey: 'not-a-real-key',
      fetch: fetchMock,
    });
    const product = toProduct(PRODUCT_MASTER.find(({ code }) => code === '0195R0')!);

    await expect(
      provider.fetchProductData(product, { from: '2026-08-24', to: '2026-08-25' }),
    ).rejects.toMatchObject({
      code: 'UNDERLYING_SERIES_IDENTITY_MISMATCH',
      retryable: false,
    });
  });

  it.each([
    ['before the requested start', '20260823'],
    ['after the requested end', '20260826'],
  ])('fails closed on a normalized trade date %s', async (_label, basDt) => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            response: {
              header: { resultCode: '00', resultMsg: 'NORMAL SERVICE.' },
              body: {
                numOfRows: 1,
                pageNo: 1,
                totalCount: 1,
                items: {
                  item: {
                    basDt,
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
      ),
    );
    const provider = new LiveFscMarketDataProvider({
      serviceKey: 'not-a-real-key',
      fetch: fetchMock,
    });
    const product = toProduct(PRODUCT_MASTER.find(({ code }) => code === '0195R0')!);

    await expect(
      provider.fetchProductData(product, { from: '2026-08-24', to: '2026-08-25' }),
    ).rejects.toMatchObject({ code: 'OUT_OF_RANGE_TRADE_DATE', retryable: false });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('applies the requested range invariant to the normalized underlying series too', async () => {
    const fetchMock = vi.fn((input: string | URL | Request) => {
      const url = new URL(
        typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
      );
      const isProduct = url.pathname.endsWith('/getETFPriceInfo');
      const item = isProduct
        ? {
            basDt: '20260825',
            srtnCd: 'F2UP01',
            itmsNm: '[체험용] 반도체 대표주 레버리지 2X',
            clpr: '10355',
          }
        : {
            basDt: '20260826',
            srtnCd: 'FIXBASEUP',
            itmsNm: '[체험용] 반도체 대표주',
            clpr: '101.8',
          };
      return Promise.resolve(
        new Response(
          JSON.stringify({
            response: {
              header: { resultCode: '00', resultMsg: 'NORMAL SERVICE.' },
              body: {
                numOfRows: 1,
                pageNo: 1,
                totalCount: 1,
                items: { item },
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

    await expect(
      provider.fetchProductData(getFixtureProductData('F2UP01')!.product, {
        from: '2026-08-24',
        to: '2026-08-25',
      }),
    ).rejects.toMatchObject({ code: 'OUT_OF_RANGE_TRADE_DATE', retryable: false });
    expect(fetchMock).toHaveBeenCalledTimes(2);
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

  it('does not retry a daily-quota FSC envelope', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify(DAILY_QUOTA_FSC_ENVELOPE), { status: 200 })),
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
    ).rejects.toMatchObject({ code: '22', retryable: false });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(sleep).not.toHaveBeenCalled();
  });

  it('fails closed when pagination reports remaining rows without returning an item', async () => {
    const stalledPage = {
      response: {
        header: { resultCode: '00', resultMsg: 'NORMAL SERVICE.' },
        body: { numOfRows: 1, pageNo: 1, totalCount: 1, items: { item: [] } },
      },
    };
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify(stalledPage), { status: 200 })),
    );
    const provider = new LiveFscMarketDataProvider({
      serviceKey: 'secret-value',
      fetch: fetchMock,
    });

    await expect(
      provider.fetchProductData(toProduct(PRODUCT_MASTER[0]!), {
        from: '2026-08-24',
        to: '2026-08-25',
      }),
    ).rejects.toMatchObject({ code: 'PAGINATION_STALLED', retryable: false });
    expect(fetchMock).toHaveBeenCalledOnce();
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
    ).rejects.toMatchObject({ code: '23', retryable: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenNthCalledWith(1, 100);
    expect(sleep).toHaveBeenNthCalledWith(2, 200);
  });

  it('allows a batch caller to widen the bounded exponential retry delay', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify(RETRYABLE_FSC_ENVELOPE), { status: 200 })),
    );
    const sleep = vi.fn(() => Promise.resolve());
    const provider = new LiveFscMarketDataProvider({
      serviceKey: 'secret-value',
      fetch: fetchMock,
      maxRetries: 2,
      retryBaseDelayMs: 1_000,
      sleep,
    });

    await expect(
      provider.fetchProductData(toProduct(PRODUCT_MASTER[0]!), {
        from: '2026-08-24',
        to: '2026-08-25',
      }),
    ).rejects.toMatchObject({ code: '23', retryable: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenNthCalledWith(1, 1_000);
    expect(sleep).toHaveBeenNthCalledWith(2, 2_000);
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
