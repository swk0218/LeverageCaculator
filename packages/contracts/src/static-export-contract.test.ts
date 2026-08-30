import { describe, expect, it } from 'vitest';

import { AnalysisDataResponseSchema, getFixtureProductData } from './index';

describe('static market-data export contract', () => {
  it('accepts validated FSC data delivered as a static live response', () => {
    const fixture = getFixtureProductData('FACT01')!;
    const response = AnalysisDataResponseSchema.parse({
      data: { ...fixture, source: 'static-export' },
      meta: { mode: 'live', generatedAt: '2026-08-30T06:40:00.000Z' },
    });

    expect(response.data.source).toBe('static-export');
    expect(response.meta.mode).toBe('live');
  });
});
