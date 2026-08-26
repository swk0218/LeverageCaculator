import { useEffect, useState } from 'react';

import { getLocalProductData } from '@calculator-product-data';
import { PRODUCT_MASTER } from '@contracts/product-master';
import { AnalysisDataResponseSchema, type ProductDataBundle } from '@contracts/schemas';

interface State {
  data: ProductDataBundle | null;
  isLoading: boolean;
  error: string | null;
}

interface LiveState extends State {
  requestKey: string;
}

const API_BASE_URL = (import.meta.env.PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8787').replace(
  /\/$/,
  '',
);

export function useProductData(productCode: string, enabled = true, retryKey = 0): State {
  const requestKey = `${productCode}:${retryKey}`;
  const listedDate = PRODUCT_MASTER.find((product) => product.code === productCode)?.listedDate;
  const [liveState, setLiveState] = useState<LiveState>(() => ({
    requestKey: '',
    data: null,
    isLoading: false,
    error: null,
  }));

  useEffect(() => {
    if (import.meta.env.PUBLIC_DATA_MODE !== 'live' || !enabled || !productCode || !listedDate)
      return;

    const controller = new AbortController();

    void fetch(
      `${API_BASE_URL}/api/v1/analysis-data?productCode=${encodeURIComponent(productCode)}&from=${listedDate}`,
      {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      },
    )
      .then(async (response) => {
        if (!response.ok) throw new Error(`가격 데이터 요청 실패 (${response.status})`);
        const payload: unknown = await response.json();
        const parsed = AnalysisDataResponseSchema.safeParse(payload);
        if (!parsed.success) throw new Error('가격 데이터 형식이 올바르지 않습니다.');
        setLiveState({ requestKey, data: parsed.data.data, isLoading: false, error: null });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setLiveState({
          requestKey,
          data: null,
          isLoading: false,
          error: error instanceof Error ? error.message : '가격 데이터를 불러오지 못했습니다.',
        });
      });

    return () => controller.abort();
  }, [enabled, listedDate, productCode, requestKey]);

  if (import.meta.env.PUBLIC_DATA_MODE !== 'live') {
    const fixture = getLocalProductData(productCode);
    return {
      data: fixture ?? null,
      isLoading: false,
      error: fixture ? null : 'Fixture 상품 데이터를 찾을 수 없습니다.',
    };
  }

  if (!enabled) return { data: null, isLoading: false, error: null };
  if (!productCode) return { data: null, isLoading: false, error: '상품을 먼저 선택해 주세요.' };
  if (!listedDate)
    return { data: null, isLoading: false, error: '검증된 상품 기준일을 찾을 수 없습니다.' };
  if (liveState.requestKey !== requestKey) {
    return { data: null, isLoading: true, error: null };
  }

  return liveState;
}
