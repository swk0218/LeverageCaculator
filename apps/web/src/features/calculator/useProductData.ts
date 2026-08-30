import { useEffect, useState } from 'react';

import { getLocalProductData } from '@calculator-product-data';
import { PRODUCT_MASTER } from '@contracts/product-master';
import { AnalysisDataResponseSchema, type ProductDataBundle } from '@contracts/schemas';

import {
  assertRequestedProductCode,
  createProductDataRequest,
  ProductDataError,
} from './productDataClient';

interface State {
  data: ProductDataBundle | null;
  isLoading: boolean;
  error: string | null;
}

interface LiveState extends State {
  requestKey: string;
}

const API_BASE_URL = import.meta.env.PUBLIC_API_BASE_URL ?? '';
const REQUEST_TIMEOUT_MS = 10_000;

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
    let timedOut = false;
    const timeoutId = globalThis.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    const request = createProductDataRequest(productCode, listedDate, API_BASE_URL);

    void fetch(request.url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
      ...(request.cache === undefined ? {} : { cache: request.cache }),
    })
      .then(async (response) => {
        if (!response.ok)
          throw new ProductDataError(
            '가격 제공 서버가 잠시 응답하지 않습니다. 다시 시도해 주세요.',
          );
        let payload: unknown;
        try {
          payload = await response.json();
        } catch {
          throw new ProductDataError('가격 데이터 응답을 읽을 수 없습니다. 다시 시도해 주세요.');
        }
        const parsed = AnalysisDataResponseSchema.safeParse(payload);
        if (!parsed.success)
          throw new ProductDataError('가격 데이터 형식이 올바르지 않습니다. 다시 시도해 주세요.');
        assertRequestedProductCode(productCode, parsed.data.data.product.code);
        setLiveState({ requestKey, data: parsed.data.data, isLoading: false, error: null });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted && !timedOut) return;
        setLiveState({
          requestKey,
          data: null,
          isLoading: false,
          error: timedOut
            ? '가격 데이터 요청 시간이 초과되었습니다. 다시 시도해 주세요.'
            : error instanceof ProductDataError
              ? error.message
              : '네트워크 연결을 확인하고 다시 시도해 주세요.',
        });
      })
      .finally(() => globalThis.clearTimeout(timeoutId));

    return () => {
      globalThis.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [enabled, listedDate, productCode, requestKey]);

  if (import.meta.env.PUBLIC_DATA_MODE !== 'live') {
    const fixture = getLocalProductData(productCode);
    return {
      data: fixture ?? null,
      isLoading: false,
      error: fixture ? null : '체험용 상품 데이터를 찾을 수 없습니다.',
    };
  }

  if (!enabled) return { data: null, isLoading: false, error: null };
  if (!productCode) return { data: null, isLoading: false, error: null };
  if (!listedDate)
    return { data: null, isLoading: false, error: '검증된 상품 기준일을 찾을 수 없습니다.' };
  if (liveState.requestKey !== requestKey) {
    return { data: null, isLoading: true, error: null };
  }

  return liveState;
}
