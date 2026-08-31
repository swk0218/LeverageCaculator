import { useEffect, useMemo, useRef, useState } from 'react';

import { AVAILABLE_PRODUCTS, getLocalProductData } from '@calculator-product-data';
import {
  analyzePosition,
  calculateTransactionLedger,
  type AnalysisResult,
  type Purchase,
  type Sale,
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
import { SaleList } from './components/SaleList';
import { clearState, loadState, saveState } from './storage';
import type { PurchaseDraft, PurchaseDraftErrors, SaleDraft, SaleDraftErrors } from './types';
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

const emptySaleDraft = (): SaleDraft => ({
  id: globalThis.crypto?.randomUUID?.() ?? `sale-${Date.now()}-${Math.random()}`,
  date: '',
  price: '',
  quantity: '',
});

export function CalculatorApp() {
  const products = AVAILABLE_PRODUCTS;
  const [selectedCode, setSelectedCode] = useState(DEFAULT_PRODUCT_CODE);
  const [drafts, setDrafts] = useState<PurchaseDraft[]>(() => [emptyDraft(DEFAULT_PRODUCT_CODE)]);
  const [saleDrafts, setSaleDrafts] = useState<SaleDraft[]>([]);
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
        setSaleDrafts(restored.sales ?? []);
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
      sales: saleDrafts,
      manualCurrentPrice: manualPrice,
    });
  }, [drafts, hasRestored, manualPrice, persistInputs, saleDrafts, selectedCode]);

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
            errors.date = `상장일(${data.product.listedDate}) 이후를 입력해 주세요.`;
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

  const saleAvailableQuantities = useMemo<Record<string, number>>(() => {
    if (!data || !availableDates) return {};
    const lots = drafts
      .map((draft) => ({
        date: draft.date,
        quantity: parseInteger(draft.quantity),
      }))
      .filter(
        (draft) =>
          draft.date &&
          availableDates.product.has(draft.date) &&
          Number.isSafeInteger(draft.quantity) &&
          draft.quantity >= 1,
      )
      .sort((left, right) => left.date.localeCompare(right.date));
    const orderedSales = saleDrafts
      .map((draft, index) => ({ draft, index }))
      .sort(
        (left, right) =>
          left.draft.date.localeCompare(right.draft.date) || left.index - right.index,
      );
    const available: Record<string, number> = {};

    for (const { draft } of orderedSales) {
      const total = lots.reduce(
        (sum, lot) => (lot.date <= draft.date ? sum + lot.quantity : sum),
        0,
      );
      available[draft.id] = total;
      const quantity = parseInteger(draft.quantity);
      if (!draft.date || !Number.isSafeInteger(quantity) || quantity < 1) continue;
      let toAllocate = Math.min(quantity, total);
      for (const lot of lots) {
        if (toAllocate === 0) break;
        if (lot.date > draft.date || lot.quantity === 0) continue;
        const allocated = Math.min(toAllocate, lot.quantity);
        lot.quantity -= allocated;
        toAllocate -= allocated;
      }
    }
    return available;
  }, [availableDates, data, drafts, saleDrafts]);

  const saleErrors = useMemo<Record<string, SaleDraftErrors>>(() => {
    if (!data || !availableDates) return {};
    const today = todayInKorea();

    return Object.fromEntries(
      saleDrafts.map((draft) => {
        const errors: SaleDraftErrors = {};
        const price = parseInteger(draft.price);
        const quantity = parseInteger(draft.quantity);

        if (!draft.date && submitAttempted) errors.date = '매도일을 입력해 주세요.';
        else if (draft.date) {
          if (draft.date > today) errors.date = '미래 날짜는 입력할 수 없습니다.';
          else if (draft.date < data.product.listedDate)
            errors.date = `상장일(${data.product.listedDate}) 이후를 입력해 주세요.`;
          else if (!availableDates.product.has(draft.date))
            errors.date = '이 날짜의 공식 상품 가격이 없습니다.';
        }

        const validPrice = Number.isSafeInteger(price) && price >= 1;
        const validQuantity = Number.isSafeInteger(quantity) && quantity >= 1;
        if (!draft.price && submitAttempted) errors.price = '매도가를 입력해 주세요.';
        else if (draft.price && !validPrice)
          errors.price = '매도가는 1원 이상 정수로 입력해 주세요.';
        if (!draft.quantity && submitAttempted) errors.quantity = '매도 수량을 입력해 주세요.';
        else if (draft.quantity && !validQuantity)
          errors.quantity = '매도 수량은 1주 이상 정수로 입력해 주세요.';
        if (validPrice && validQuantity && !Number.isSafeInteger(price * quantity))
          errors.price = '입력 금액이 너무 큽니다.';

        const available = saleAvailableQuantities[draft.id] ?? 0;
        if (validQuantity && !errors.date) {
          if (available === 0) errors.quantity = '이 날짜에는 매도할 수량이 없습니다.';
          else if (quantity > available)
            errors.quantity = `보유수량보다 많이 매도할 수 없습니다. 현재 보유: ${available.toLocaleString('ko-KR')}주`;
        }

        return [draft.id, errors];
      }),
    );
  }, [availableDates, data, saleAvailableQuantities, saleDrafts, submitAttempted]);

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
  const salesForSummary = useMemo<Sale[]>(
    () =>
      saleDrafts.flatMap((draft) => {
        const priceWon = parseInteger(draft.price);
        const quantity = parseInteger(draft.quantity);
        if (
          !draft.date ||
          !Number.isSafeInteger(priceWon) ||
          priceWon < 1 ||
          !Number.isSafeInteger(quantity) ||
          quantity < 1 ||
          !Number.isSafeInteger(priceWon * quantity)
        )
          return [];
        return [{ id: draft.id, date: draft.date, priceWon, quantity }];
      }),
    [saleDrafts],
  );
  const summaryState = useMemo(() => {
    if (purchasesForSummary.length === 0) {
      return {
        summary: { totalCostWon: 0, totalQuantity: 0, averagePriceWon: 0 },
        ledger: null,
        error: null as string | null,
      };
    }
    try {
      const ledger = calculateTransactionLedger(purchasesForSummary, salesForSummary);
      return {
        summary: {
          totalCostWon: ledger.totalPurchaseCostWon,
          totalQuantity: ledger.remainingQuantity,
          averagePriceWon: ledger.remainingAveragePriceWon,
        },
        ledger,
        error: null,
      };
    } catch (error) {
      return {
        summary: { totalCostWon: 0, totalQuantity: 0, averagePriceWon: 0 },
        ledger: null,
        error: error instanceof Error ? error.message : '매수내역 합계를 계산할 수 없습니다.',
      };
    }
  }, [purchasesForSummary, salesForSummary]);
  const summary = summaryState.summary;
  const currentPrice =
    manualPrice !== null ? parseInteger(manualPrice) : data?.latest.product.close;
  const manualPriceDraftValue = parseInteger(manualPriceDraft);
  const manualPriceDraftError =
    isEditingPrice && (!Number.isSafeInteger(manualPriceDraftValue) || manualPriceDraftValue < 1)
      ? '현재가는 1원 이상 정수로 입력해 주세요.'
      : undefined;
  const hasEmptyFields =
    drafts.some((draft) => !draft.date || !draft.price || !draft.quantity) ||
    saleDrafts.some((draft) => !draft.date || !draft.price || !draft.quantity);
  const hasFieldErrors =
    Object.values(draftErrors).some((row) => Object.keys(row).length > 0) ||
    Object.values(saleErrors).some((row) => Object.keys(row).length > 0);
  const canCalculate =
    Boolean(data && currentPrice && Number.isFinite(currentPrice) && currentPrice > 0) &&
    !hasEmptyFields &&
    !hasFieldErrors &&
    !isEditingPrice &&
    !summaryState.error;
  const hasPurchaseInput =
    drafts.length > 1 ||
    saleDrafts.length > 0 ||
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
    if (saleDrafts.some((draft) => !draft.date || !draft.price || !draft.quantity))
      return '매도내역을 입력하면 계산할 수 있습니다.';
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

  const updateSaleDraft = (id: string, field: keyof Omit<SaleDraft, 'id'>, value: string) => {
    setSaleDrafts((current) =>
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

  const removeSaleDraft = (id: string) => {
    const removedIndex = saleDrafts.findIndex((draft) => draft.id === id);
    const remaining = saleDrafts.filter((draft) => draft.id !== id);
    const nextFocus = remaining[Math.min(Math.max(removedIndex, 0), remaining.length - 1)];
    setSaleDrafts(remaining);
    setFocusDraftId(nextFocus?.id ?? null);
    setStatusMessage('매도내역 한 건을 삭제했습니다.');
    invalidateResult();
    requestAnimationFrame(() => {
      if (!nextFocus) return;
      const row = [...document.querySelectorAll<HTMLElement>('[data-sale-id]')].find(
        (element) => element.dataset.saleId === nextFocus.id,
      );
      row?.querySelector<HTMLInputElement>('input[type="date"]')?.focus();
    });
  };

  const addSaleDraft = () => {
    if (saleDrafts.length >= 50) return;
    const nextDraft = emptySaleDraft();
    setSaleDrafts((current) => [...current, nextDraft]);
    setFocusDraftId(nextDraft.id);
    setSubmitAttempted(false);
    invalidateResult();
    setStatusMessage(`매도 ${saleDrafts.length + 1} 입력란을 추가했습니다.`);
  };

  const selectProduct = (code: string): boolean => {
    if (code === selectedCode) return true;
    if (
      (hasPurchaseInput || manualPrice !== null) &&
      !globalThis.confirm(
        '상품을 바꾸면 현재 거래내역과 직접 입력한 현재가가 지워집니다. 계속할까요?',
      )
    ) {
      return false;
    }

    setSelectedCode(code);
    setDataRetryKey(0);
    setDrafts([emptyDraft(code)]);
    setSaleDrafts([]);
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
      !globalThis.confirm('입력한 거래내역과 이 브라우저에 저장된 값을 모두 지울까요?')
    ) {
      return;
    }
    skipNextSaveRef.current = true;
    clearState();
    setSelectedCode(DEFAULT_PRODUCT_CODE);
    setDrafts([emptyDraft(DEFAULT_PRODUCT_CODE)]);
    setSaleDrafts([]);
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
    const sales: Sale[] = saleDrafts.map((draft) => ({
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
          sales,
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
          [...drafts, ...saleDrafts].reduce((copy, draft) => {
            const purchaseIndex = drafts.findIndex((purchase) => purchase.id === draft.id);
            const saleIndex = saleDrafts.findIndex((sale) => sale.id === draft.id);
            return copy
              .replaceAll(
                `매수분 ${draft.id}`,
                purchaseIndex >= 0 ? `매수 ${purchaseIndex + 1}` : `매수분 ${draft.id}`,
              )
              .replaceAll(
                `매도분 ${draft.id}`,
                saleIndex >= 0 ? `매도 ${saleIndex + 1}` : `매도분 ${draft.id}`,
              );
          }, warning),
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
              afterAdd={
                <SaleList
                  drafts={saleDrafts}
                  errors={saleErrors}
                  availableQuantities={saleAvailableQuantities}
                  focusDraftId={focusDraftId}
                  maxDate={todayInKorea()}
                  minDate={data.product.listedDate}
                  onChange={updateSaleDraft}
                  onRemove={removeSaleDraft}
                  onAdd={addSaleDraft}
                />
              }
            />
            <PurchaseSummary
              {...summary}
              hasSales={saleDrafts.length > 0}
              soldQuantity={summaryState.ledger?.soldQuantity ?? 0}
              realizedPnlWon={summaryState.ledger?.realizedPnlWon ?? 0}
            />
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
                      ? '거래내역을 이 기기에 30일간 저장합니다.'
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
                  ? `손익·본전 직접 입력가 · 복리 ${result.analysisDate} 공식 데이터`
                  : '손익·본전 직접 입력가'
                : `${data.latest.product.date} 종가 기준`}
            </p>
          </div>
          <PartialAnalysisState warnings={resultWarnings} />
          {data.product.analysisCapability === 'full' &&
            selectedScenario &&
            result.totalQuantity > 0 && (
              <BreakEvenSelector
                product={data.product}
                scenario={selectedScenario}
                selectedPeriod={selectedPeriod}
                currentUnderlyingPrice={analysisUnderlying}
                analysisDate={result.analysisDate}
                hasSales={result.soldQuantity > 0}
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
