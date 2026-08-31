import { useEffect, useMemo, useRef, useState } from 'react';

import { AVAILABLE_PRODUCTS, getLocalProductData } from '@calculator-product-data';
import {
  analyzePosition,
  calculatePurchaseSummary,
  type AnalysisResult,
  type Purchase,
} from '@yangbok/core';

import './calculator.css';
import { ActualDetail } from './components/ActualDetail';
import { BreakEvenSelector } from './components/BreakEvenSelector';
import { CalculateButton } from './components/CalculateButton';
import { CompoundComparison } from './components/CompoundComparison';
import { CurrentPriceControl } from './components/CurrentPriceControl';
import { DataFreshnessNotice } from './components/DataFreshnessNotice';
import { PartialAnalysisState } from './components/PartialAnalysisState';
import { PersistenceControl } from './components/PersistenceControl';
import { ProductSearch } from './components/ProductSearch';
import { PurchaseList } from './components/PurchaseList';
import { PurchaseSummary } from './components/PurchaseSummary';
import { ResultSummary } from './components/ResultSummary';
import { clearState, loadState, saveState } from './storage';
import type { PurchaseDraft, PurchaseDraftErrors } from './types';
import { useProductData } from './useProductData';

const PRODUCT_DATA_MODE = import.meta.env.PUBLIC_DATA_MODE === 'live' ? 'live' : 'fixture';
const DEFAULT_PRODUCT_CODE =
  PRODUCT_DATA_MODE === 'fixture' ? (AVAILABLE_PRODUCTS[0]?.code ?? '') : '';

const parseInteger = (value: string): number => Number(value.replaceAll(',', ''));

const todayInKorea = (): string => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
};

const defaultPurchaseDate = (productCode: string): string => {
  const localSeriesStart = getLocalProductData(productCode)?.productSeries[0]?.date;
  if (localSeriesStart) return localSeriesStart;

  const listedDate = AVAILABLE_PRODUCTS.find((product) => product.code === productCode)?.listedDate;
  const year = listedDate?.slice(0, 4) ?? todayInKorea().slice(0, 4);
  const preferredDate = `${year}-06-01`;
  return listedDate && listedDate > preferredDate ? listedDate : preferredDate;
};

const emptyDraft = (productCode = ''): PurchaseDraft => ({
  id: globalThis.crypto?.randomUUID?.() ?? `purchase-${Date.now()}-${Math.random()}`,
  date: defaultPurchaseDate(productCode),
  price: '',
  quantity: '',
});

export function CalculatorApp() {
  const products = AVAILABLE_PRODUCTS;
  const [selectedCode, setSelectedCode] = useState(DEFAULT_PRODUCT_CODE);
  const [drafts, setDrafts] = useState<PurchaseDraft[]>(() => [emptyDraft(DEFAULT_PRODUCT_CODE)]);
  const [manualPrice, setManualPrice] = useState<string | null>(null);
  const [manualPriceDraft, setManualPriceDraft] = useState('');
  const [persistInputs, setPersistInputs] = useState(false);
  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState(20);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [calculationError, setCalculationError] = useState<string | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [focusDraftId, setFocusDraftId] = useState<string | null>(null);
  const [hasRestored, setHasRestored] = useState(false);
  const [dataRetryKey, setDataRetryKey] = useState(0);
  const resultRef = useRef<HTMLElement>(null);
  const calculationErrorRef = useRef<HTMLElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const skipNextSaveRef = useRef(false);
  const {
    data,
    isLoading,
    error: dataError,
  } = useProductData(selectedCode, PRODUCT_DATA_MODE === 'fixture' || hasRestored, dataRetryKey);

  useEffect(() => {
    const restored = loadState();
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      if (restored && products.some((product) => product.code === restored.productCode)) {
        setSelectedCode(restored.productCode);
        setDrafts(restored.purchases);
        const restoredManualPrice = restored.manualCurrentPrice;
        const parsedManualPrice = restoredManualPrice ? parseInteger(restoredManualPrice) : 0;
        setManualPrice(
          restoredManualPrice && Number.isSafeInteger(parsedManualPrice) && parsedManualPrice >= 1
            ? restoredManualPrice
            : null,
        );
        setPersistInputs(true);
        setStatusMessage('이 기기에 저장된 입력을 복원했습니다.');
      }
      setHasRestored(true);
    });
    return () => {
      active = false;
    };
  }, [products]);

  useEffect(() => {
    if (!hasRestored) return;
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    if (!persistInputs) {
      clearState();
      return;
    }
    saveState({
      version: 2,
      persistInputs: true,
      productCode: selectedCode,
      purchases: drafts,
      manualCurrentPrice: manualPrice,
    });
  }, [drafts, hasRestored, manualPrice, persistInputs, selectedCode]);

  const availableDates = useMemo(
    () =>
      data
        ? {
            product: new Set(data.productSeries.map((point) => point.date)),
          }
        : null,
    [data],
  );

  const draftErrors = useMemo<Record<string, PurchaseDraftErrors>>(() => {
    if (!data || !availableDates) return {};
    const today = todayInKorea();

    return Object.fromEntries(
      drafts.map((draft) => {
        const errors: PurchaseDraftErrors = {};
        const price = parseInteger(draft.price);
        const quantity = parseInteger(draft.quantity);

        if (!draft.date && submitAttempted) errors.date = '매수일을 입력해 주세요.';
        else if (draft.date) {
          if (draft.date > today) errors.date = '미래 날짜는 입력할 수 없습니다.';
          else if (draft.date < data.product.listedDate)
            errors.date = `상장일(${data.product.listedDate.replaceAll('-', '.')}) 이후를 입력해 주세요.`;
          else if (!availableDates.product.has(draft.date))
            errors.date = '이 날짜의 공식 상품 가격이 없습니다.';
        }

        const validPrice = Number.isSafeInteger(price) && price >= 1;
        const validQuantity = Number.isSafeInteger(quantity) && quantity >= 1;
        if (!draft.price && submitAttempted) errors.price = '매수가를 입력해 주세요.';
        else if (draft.price && !validPrice)
          errors.price = '매수가는 1원 이상 정수로 입력해 주세요.';
        if (!draft.quantity && submitAttempted) errors.quantity = '수량을 입력해 주세요.';
        else if (draft.quantity && !validQuantity)
          errors.quantity = '수량은 1주 이상 정수로 입력해 주세요.';
        if (validPrice && validQuantity && !Number.isSafeInteger(price * quantity))
          errors.price = '입력 금액이 너무 큽니다.';

        return [draft.id, errors];
      }),
    );
  }, [availableDates, data, drafts, submitAttempted]);

  const purchasesForSummary = useMemo<Purchase[]>(
    () =>
      drafts.flatMap((draft) => {
        const priceWon = parseInteger(draft.price);
        const quantity = parseInteger(draft.quantity);
        if (
          !Number.isSafeInteger(priceWon) ||
          priceWon < 1 ||
          !Number.isSafeInteger(quantity) ||
          quantity < 1 ||
          !Number.isSafeInteger(priceWon * quantity)
        )
          return [];
        return [{ id: draft.id, date: draft.date || '1970-01-01', priceWon, quantity }];
      }),
    [drafts],
  );
  const summaryState = useMemo(() => {
    if (purchasesForSummary.length === 0) {
      return {
        summary: { totalCostWon: 0, totalQuantity: 0, averagePriceWon: 0 },
        error: null as string | null,
      };
    }
    try {
      return { summary: calculatePurchaseSummary(purchasesForSummary), error: null };
    } catch (error) {
      return {
        summary: { totalCostWon: 0, totalQuantity: 0, averagePriceWon: 0 },
        error: error instanceof Error ? error.message : '매수내역 합계를 계산할 수 없습니다.',
      };
    }
  }, [purchasesForSummary]);
  const summary = summaryState.summary;
  const currentPrice =
    manualPrice !== null ? parseInteger(manualPrice) : data?.latest.product.close;
  const manualPriceDraftValue = parseInteger(manualPriceDraft);
  const manualPriceDraftError =
    isEditingPrice && (!Number.isSafeInteger(manualPriceDraftValue) || manualPriceDraftValue < 1)
      ? '현재가는 1원 이상 정수로 입력해 주세요.'
      : undefined;
  const hasEmptyFields = drafts.some((draft) => !draft.date || !draft.price || !draft.quantity);
  const hasFieldErrors = Object.values(draftErrors).some((row) => Object.keys(row).length > 0);
  const canCalculate =
    Boolean(data && currentPrice && Number.isFinite(currentPrice) && currentPrice > 0) &&
    !hasEmptyFields &&
    !hasFieldErrors &&
    !isEditingPrice &&
    !summaryState.error;
  const hasPurchaseInput =
    drafts.length > 1 ||
    drafts.some(
      (draft) =>
        draft.price ||
        draft.quantity ||
        (draft.date && draft.date !== defaultPurchaseDate(selectedCode)),
    );
  const hasResettableState =
    selectedCode !== DEFAULT_PRODUCT_CODE ||
    hasPurchaseInput ||
    manualPrice !== null ||
    persistInputs;

  const calculateHelp = (() => {
    if (isEditingPrice) return '현재가 변경을 적용하거나 취소해 주세요.';
    if (hasFieldErrors) return '입력값을 확인하세요.';
    if (summaryState.error) return summaryState.error;
    if (drafts.some((draft) => !draft.date)) return '매수일을 입력하면 계산할 수 있습니다.';
    if (drafts.some((draft) => !draft.price)) return '매수가를 입력하면 계산할 수 있습니다.';
    if (drafts.some((draft) => !draft.quantity)) return '수량을 입력하면 계산할 수 있습니다.';
    if (!data) return '가격 데이터를 불러온 뒤 계산할 수 있습니다.';
    return '';
  })();

  const invalidateResult = () => {
    setResult(null);
    setCalculationError(null);
  };

  const updateDraft = (id: string, field: keyof Omit<PurchaseDraft, 'id'>, value: string) => {
    setDrafts((current) =>
      current.map((draft) => (draft.id === id ? { ...draft, [field]: value } : draft)),
    );
    setFocusDraftId(null);
    invalidateResult();
  };

  const removeDraft = (id: string) => {
    if (drafts.length === 1) return;
    const removedIndex = drafts.findIndex((draft) => draft.id === id);
    const remaining = drafts.filter((draft) => draft.id !== id);
    const nextFocus = remaining[Math.min(Math.max(removedIndex, 0), remaining.length - 1)];
    setDrafts(remaining);
    setFocusDraftId(nextFocus?.id ?? null);
    setStatusMessage('매수내역 한 건을 삭제했습니다.');
    invalidateResult();
    requestAnimationFrame(() => {
      if (!nextFocus) return;
      const row = [...document.querySelectorAll<HTMLElement>('[data-purchase-id]')].find(
        (element) => element.dataset.purchaseId === nextFocus.id,
      );
      row?.querySelector<HTMLInputElement>('input[type="date"]')?.focus();
    });
  };

  const addDraft = () => {
    if (drafts.length >= 50) return;
    const nextDraft = emptyDraft(selectedCode);
    setDrafts((current) => [...current, nextDraft]);
    setFocusDraftId(nextDraft.id);
    setSubmitAttempted(false);
    invalidateResult();
    setStatusMessage(`매수 ${drafts.length + 1} 입력란을 추가했습니다.`);
  };

  const selectProduct = (code: string): boolean => {
    if (code === selectedCode) return true;
    if (
      (hasPurchaseInput || manualPrice !== null) &&
      !globalThis.confirm(
        '상품을 바꾸면 현재 매수내역과 직접 입력한 현재가가 지워집니다. 계속할까요?',
      )
    ) {
      return false;
    }

    setSelectedCode(code);
    setDataRetryKey(0);
    setDrafts([emptyDraft(code)]);
    setFocusDraftId(null);
    setManualPrice(null);
    setManualPriceDraft('');
    setIsEditingPrice(false);
    setSelectedPeriod(20);
    setSubmitAttempted(false);
    invalidateResult();
    setStatusMessage('상품을 변경하고 새 입력을 준비했습니다.');
    return true;
  };

  const resetAll = () => {
    if (
      (hasPurchaseInput || manualPrice !== null) &&
      !globalThis.confirm('입력한 매수내역과 이 브라우저에 저장된 값을 모두 지울까요?')
    ) {
      return;
    }
    skipNextSaveRef.current = true;
    clearState();
    setSelectedCode(DEFAULT_PRODUCT_CODE);
    setDrafts([emptyDraft(DEFAULT_PRODUCT_CODE)]);
    setFocusDraftId(null);
    setManualPrice(null);
    setManualPriceDraft('');
    setPersistInputs(false);
    setIsEditingPrice(false);
    setSelectedPeriod(20);
    setSubmitAttempted(false);
    invalidateResult();
    setStatusMessage('입력과 이 브라우저에 저장된 값을 모두 지웠습니다.');
    requestAnimationFrame(() => searchInputRef.current?.focus());
  };

  const calculate = () => {
    setSubmitAttempted(true);
    if (!data || !canCalculate || currentPrice === undefined) {
      requestAnimationFrame(() => {
        const firstInvalid = document.querySelector<HTMLInputElement>(
          '.calculator-frame input:invalid, .calculator-frame input[aria-invalid="true"]',
        );
        firstInvalid?.focus();
      });
      return;
    }
    const purchases: Purchase[] = drafts.map((draft) => ({
      id: draft.id,
      date: draft.date,
      priceWon: parseInteger(draft.price),
      quantity: parseInteger(draft.quantity),
    }));

    try {
      const nextResult = analyzePosition(
        {
          product: data.product,
          purchases,
          currentProductPrice: currentPrice,
          productSeries: data.productSeries,
          underlyingSeries: data.underlyingSeries,
        },
        [1, 5, 20],
      );
      setResult(nextResult);
      setCalculationError(null);
      requestAnimationFrame(() => {
        resultRef.current?.focus({ preventScroll: true });
        const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        resultRef.current?.scrollIntoView({
          behavior: reducedMotion ? 'auto' : 'smooth',
          block: 'start',
        });
      });
    } catch (error) {
      setResult(null);
      setCalculationError(
        error instanceof Error ? error.message : '계산 중 알 수 없는 오류가 발생했습니다.',
      );
      requestAnimationFrame(() => {
        calculationErrorRef.current?.focus({ preventScroll: true });
        calculationErrorRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' });
      });
    }
  };

  const selectedScenario = result?.breakEvenScenarios.find(
    (scenario) => scenario.tradingDays === selectedPeriod,
  );
  const analysisUnderlying = result?.analysisDate
    ? data?.underlyingSeries.find((point) => point.date === result.analysisDate)?.close
    : undefined;
  const mismatch = Boolean(
    data?.latest.underlying && data.latest.underlying.date !== data.latest.product.date,
  );
  const resultWarnings = (() => {
    if (!data || !result) return [];
    const repeatedDataWarnings = [
      '공식 가격 기준일이',
      '상품과 기초자산의 최신 기준일이',
      '일간 배수 산정 원지수인',
      '검증된 기초자산 시계열이',
      '기초지수 매핑이 검증되지 않아',
    ];
    const warnings = [
      ...data.warnings.filter(
        (warning) => !repeatedDataWarnings.some((prefix) => warning.startsWith(prefix)),
      ),
      ...result.warnings,
    ];
    return [
      ...new Set(
        warnings.map((warning) =>
          drafts.reduce(
            (copy, draft, index) => copy.replaceAll(`매수분 ${draft.id}`, `매수 ${index + 1}`),
            warning,
          ),
        ),
      ),
    ];
  })();

  return (
    <div
      className="calculator-root"
      data-testid="calculator-root"
      data-hydrated={hasRestored ? 'true' : 'false'}
    >
      <form
        className="calculator-frame"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          calculate();
        }}
      >
        <DataFreshnessNotice
          stale={data?.stale.isStale ?? false}
          date={data?.stale.asOf ?? ''}
          mismatch={mismatch}
        />
        <ProductSearch
          products={products}
          selectedCode={selectedCode}
          inputRef={searchInputRef}
          onSelect={selectProduct}
        />

        {isLoading && (
          <div className="calculator-section" role="status" aria-live="polite">
            공식 가격 데이터를 불러오는 중입니다.
          </div>
        )}
        {dataError && (
          <div className="calculator-section error-state" role="alert">
            <h2>가격 데이터를 불러오지 못했습니다.</h2>
            <p>{dataError}</p>
            <button
              type="button"
              className="outline-button"
              onClick={() => setDataRetryKey((current) => current + 1)}
            >
              다시 시도
            </button>
          </div>
        )}
        {data && (
          <>
            <PurchaseList
              drafts={drafts}
              errors={draftErrors}
              focusDraftId={focusDraftId}
              maxDate={todayInKorea()}
              minDate={data.product.listedDate}
              onChange={updateDraft}
              onRemove={removeDraft}
              onAdd={addDraft}
            />
            <PurchaseSummary {...summary} />
            {summaryState.error && (
              <p className="summary-error" role="alert">
                {summaryState.error}
              </p>
            )}
            <CurrentPriceControl
              officialPrice={data.latest.product.close}
              officialDate={data.latest.product.date}
              manualPrice={manualPrice}
              draftPrice={manualPriceDraft}
              isEditing={isEditingPrice}
              error={manualPriceDraftError}
              onEdit={() => {
                const value = manualPrice ?? `${data.latest.product.close}`;
                setManualPriceDraft(value.replace(/\B(?=(\d{3})+(?!\d))/g, ','));
                setIsEditingPrice(true);
              }}
              onDraftPriceChange={setManualPriceDraft}
              onApply={() => {
                if (manualPriceDraftError) return;
                setManualPrice(manualPriceDraft);
                setIsEditingPrice(false);
                invalidateResult();
                setStatusMessage('직접 입력한 현재가를 적용했습니다.');
              }}
              onCancel={() => {
                setManualPriceDraft('');
                setIsEditingPrice(false);
              }}
              onUseOfficial={() => {
                setManualPrice(null);
                setManualPriceDraft('');
                setIsEditingPrice(false);
                invalidateResult();
                setStatusMessage('공식 종가를 다시 사용합니다.');
              }}
            />
            <div className="calculator-actions">
              <CalculateButton ready={canCalculate} help={calculateHelp} />
            </div>
            <div className="calculator-utilities">
              <PersistenceControl
                checked={persistInputs}
                onChange={(checked) => {
                  setPersistInputs(checked);
                  if (!checked) clearState();
                  setStatusMessage(
                    checked
                      ? '매수내역을 이 기기에 30일간 저장합니다.'
                      : '저장을 끄고 이 기기의 저장값을 삭제했습니다.',
                  );
                }}
              />
              {hasResettableState && (
                <button type="button" className="reset-button" onClick={resetAll}>
                  전체 지우기
                </button>
              )}
            </div>
          </>
        )}
      </form>

      <p className="sr-only" role="status" aria-live="polite">
        {statusMessage}
      </p>

      {calculationError && (
        <section
          className="result-area error-state"
          role="alert"
          tabIndex={-1}
          ref={calculationErrorRef}
        >
          <h2>계산할 수 없습니다.</h2>
          <p>{calculationError}</p>
        </section>
      )}

      {result && data && (
        <section
          className="result-area"
          aria-labelledby="result-heading"
          tabIndex={-1}
          ref={resultRef}
        >
          <div className="result-heading">
            <h2 id="result-heading">계산 결과</h2>
            <p>
              {manualPrice !== null
                ? data.product.analysisCapability === 'full' && result.analysisDate
                  ? `손익·본전 직접 입력가 · 복리 ${result.analysisDate.replaceAll('-', '.')} 공식 데이터`
                  : '손익·본전 직접 입력가'
                : `${data.latest.product.date.replaceAll('-', '.')} 종가 기준`}
            </p>
          </div>
          <PartialAnalysisState warnings={resultWarnings} />
          {data.product.analysisCapability === 'full' && selectedScenario && (
            <BreakEvenSelector
              product={data.product}
              scenario={selectedScenario}
              selectedPeriod={selectedPeriod}
              currentUnderlyingPrice={analysisUnderlying}
              analysisDate={result.analysisDate}
              onPeriodChange={setSelectedPeriod}
            />
          )}
          <ResultSummary result={result} />
          {data.product.analysisCapability === 'full' && (
            <CompoundComparison product={data.product} result={result} />
          )}
          <ActualDetail
            result={result}
            currentPriceDate={data.latest.product.date}
            usingManualPrice={manualPrice !== null}
          />
        </section>
      )}
    </div>
  );
}
