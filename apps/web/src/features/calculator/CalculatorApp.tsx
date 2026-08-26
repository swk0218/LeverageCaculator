import { useEffect, useMemo, useRef, useState } from 'react';

import { AVAILABLE_PRODUCTS } from '@calculator-product-data';
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
import { ProductSearch } from './components/ProductSearch';
import { PurchaseList } from './components/PurchaseList';
import { PurchaseSummary } from './components/PurchaseSummary';
import { ResultSummary } from './components/ResultSummary';
import { clearState, loadState, saveState } from './storage';
import type { PurchaseDraft, PurchaseDraftErrors } from './types';
import { useProductData } from './useProductData';

const PRODUCT_DATA_MODE = import.meta.env.PUBLIC_DATA_MODE === 'live' ? 'live' : 'fixture';

const emptyDraft = (): PurchaseDraft => ({
  id: globalThis.crypto?.randomUUID?.() ?? `purchase-${Date.now()}-${Math.random()}`,
  date: '',
  price: '',
  quantity: '',
});

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

export function CalculatorApp() {
  const products = AVAILABLE_PRODUCTS;
  const [selectedCode, setSelectedCode] = useState(products[0]?.code ?? '');
  const [drafts, setDrafts] = useState<PurchaseDraft[]>(() => [emptyDraft()]);
  const [manualPrice, setManualPrice] = useState<string | null>(null);
  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState(20);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [calculationError, setCalculationError] = useState<string | null>(null);
  const [hasRestored, setHasRestored] = useState(false);
  const [dataRetryKey, setDataRetryKey] = useState(0);
  const resultRef = useRef<HTMLElement>(null);
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
        setManualPrice(restored.manualCurrentPrice);
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
    saveState({
      version: 1,
      productCode: selectedCode,
      purchases: drafts,
      manualCurrentPrice: manualPrice,
    });
  }, [drafts, hasRestored, manualPrice, selectedCode]);

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

        if (draft.date) {
          if (draft.date > today) errors.date = '미래 날짜는 입력할 수 없습니다.';
          else if (draft.date < data.product.listedDate)
            errors.date = `상장일(${data.product.listedDate.replaceAll('-', '.')}) 이후를 입력해 주세요.`;
          else if (!availableDates.product.has(draft.date))
            errors.date = '이 날짜의 공식 상품 가격이 없습니다.';
        }

        const validPrice = Number.isSafeInteger(price) && price >= 1;
        const validQuantity = Number.isSafeInteger(quantity) && quantity >= 1;
        if (draft.price && !validPrice)
          errors.price = '매수가는 안전한 계산 범위의 1원 이상 정수로 입력해 주세요.';
        if (draft.quantity && !validQuantity)
          errors.quantity = '수량은 안전한 계산 범위의 1주 이상 정수로 입력해 주세요.';
        if (validPrice && validQuantity && !Number.isSafeInteger(price * quantity))
          errors.price = '이 매수분의 금액이 안전한 계산 범위를 벗어났습니다.';

        return [draft.id, errors];
      }),
    );
  }, [availableDates, data, drafts]);

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
  const manualPriceError =
    manualPrice !== null &&
    (currentPrice === undefined || !Number.isSafeInteger(currentPrice) || currentPrice < 1)
      ? '현재가는 안전한 계산 범위의 1원 이상 정수로 입력해 주세요.'
      : undefined;
  const hasEmptyFields = drafts.some((draft) => !draft.date || !draft.price || !draft.quantity);
  const hasFieldErrors = Object.values(draftErrors).some((row) => Object.keys(row).length > 0);
  const canCalculate =
    Boolean(data && currentPrice && Number.isFinite(currentPrice) && currentPrice > 0) &&
    !hasEmptyFields &&
    !hasFieldErrors &&
    !manualPriceError &&
    !summaryState.error;

  const updateDraft = (id: string, field: keyof Omit<PurchaseDraft, 'id'>, value: string) => {
    setDrafts((current) =>
      current.map((draft) => (draft.id === id ? { ...draft, [field]: value } : draft)),
    );
    setResult(null);
    setCalculationError(null);
  };

  const removeDraft = (id: string) => {
    setDrafts((current) => {
      if (current.length === 1) return [emptyDraft()];
      return current.filter((draft) => draft.id !== id);
    });
    setResult(null);
    setCalculationError(null);
  };

  const resetAll = () => {
    skipNextSaveRef.current = true;
    clearState();
    setSelectedCode(products[0]?.code ?? '');
    setDrafts([emptyDraft()]);
    setManualPrice(null);
    setIsEditingPrice(false);
    setSelectedPeriod(20);
    setResult(null);
    setCalculationError(null);
  };

  const calculate = () => {
    if (!data || !canCalculate || currentPrice === undefined) return;
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

  return (
    <div
      className="calculator-root"
      data-testid="calculator-root"
      data-hydrated={hasRestored ? 'true' : 'false'}
    >
      <div className="calculator-frame">
        <DataFreshnessNotice
          mode={PRODUCT_DATA_MODE}
          stale={data?.stale.isStale ?? false}
          date={data?.stale.asOf ?? ''}
          mismatch={mismatch}
        />
        <ProductSearch
          products={products}
          selectedCode={selectedCode}
          onSelect={(code) => {
            setSelectedCode(code);
            setDataRetryKey(0);
            setManualPrice(null);
            setIsEditingPrice(false);
            setResult(null);
            setCalculationError(null);
          }}
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
              maxDate={todayInKorea()}
              minDate={data.product.listedDate}
              onChange={updateDraft}
              onRemove={removeDraft}
              onAdd={() => {
                if (drafts.length < 50) setDrafts((current) => [...current, emptyDraft()]);
              }}
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
              isEditing={isEditingPrice}
              error={manualPriceError}
              onEdit={() => setIsEditingPrice(true)}
              onManualPriceChange={(value) => {
                setManualPrice(value);
                setResult(null);
                setCalculationError(null);
              }}
              onUseOfficial={() => {
                setManualPrice(null);
                setIsEditingPrice(false);
                setResult(null);
              }}
            />
            <div className="calculator-actions">
              <CalculateButton disabled={!canCalculate} onCalculate={calculate} />
              <button type="button" className="reset-button" onClick={resetAll}>
                전체 초기화
              </button>
            </div>
          </>
        )}
      </div>

      {calculationError && (
        <section className="result-area error-state" role="alert">
          <h2>계산할 수 없습니다.</h2>
          <p>{calculationError}</p>
        </section>
      )}

      {result && data && (
        <section
          className="result-area"
          aria-labelledby="result-heading"
          aria-live="polite"
          tabIndex={-1}
          ref={resultRef}
        >
          <div className="result-heading">
            <h2 id="result-heading">계산 결과</h2>
            <p>
              현재가 기준{' '}
              {manualPrice !== null
                ? '직접 입력 현재가'
                : `${data.latest.product.date.replaceAll('-', '.')} 공식 종가`}{' '}
              · 공식 분석 기준 {result.analysisDate?.replaceAll('-', '.') ?? '분석 불가'}
            </p>
          </div>
          <ResultSummary
            product={data.product}
            result={result}
            scenario={selectedScenario}
            selectedPeriod={selectedPeriod}
            usingManualPrice={manualPrice !== null}
          />
          {data.product.analysisCapability === 'full' && selectedScenario && (
            <BreakEvenSelector
              product={data.product}
              scenario={selectedScenario}
              selectedPeriod={selectedPeriod}
              currentUnderlyingPrice={analysisUnderlying}
              onPeriodChange={setSelectedPeriod}
            />
          )}
          <CompoundComparison product={data.product} result={result} />
          <ActualDetail
            result={result}
            currentPriceDate={data.latest.product.date}
            usingManualPrice={manualPrice !== null}
          />
          <PartialAnalysisState warnings={[...data.warnings, ...result.warnings]} />
        </section>
      )}
    </div>
  );
}
