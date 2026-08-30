import { useId, useMemo, useState, type RefObject } from 'react';

import { Icon } from '@astryxdesign/core/Icon';
import type { Product } from '@yangbok/core';

interface Props {
  products: Product[];
  selectedCode: string;
  inputRef: RefObject<HTMLInputElement | null>;
  onSelect: (code: string) => boolean;
}

const underlyingTypeLabel: Record<Product['underlyingType'], string> = {
  stock: '현물 주식',
  'spot-index': '현물 지수',
  'futures-index': '선물 지수',
};

const baseIndexTypeLabel: Record<NonNullable<Product['baseIndexType']>, string> = {
  'price-return-index': '현물 PR 원지수',
  'futures-index': '선물 원지수',
  'total-return-index': 'TR 원지수',
};

function analysisReferenceLabel(product: Product): string {
  if (product.analysisBasis === 'reference-stock-proxy') return '본주 환산 참고';
  return product.underlyingType === 'stock'
    ? '본주 기준 분석'
    : underlyingTypeLabel[product.underlyingType];
}

function analysisReferenceNoun(product: Product): string {
  return product.underlyingType === 'stock' ? '분석 기준주식' : '기초지수';
}

export function ProductSearch({ products, selectedCode, inputRef, onSelect }: Props) {
  const inputId = useId();
  const listId = useId();
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const selected = products.find((product) => product.code === selectedCode);
  const results = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('ko-KR');
    if (!normalized) return products;
    return products.filter((product) =>
      [product.name, product.code, product.underlyingName].some((value) =>
        value.toLocaleLowerCase('ko-KR').includes(normalized),
      ),
    );
  }, [products, query]);

  const chooseProduct = (code: string) => {
    if (!onSelect(code)) return;
    setQuery('');
    setIsOpen(false);
    setActiveIndex(-1);
  };

  const activeOption = isOpen && activeIndex >= 0 ? results[activeIndex] : undefined;

  return (
    <section className="calculator-section product-section" aria-labelledby="product-heading">
      <div className="section-heading-row">
        <div>
          <h2 id="product-heading">상품</h2>
        </div>
        <span className="section-hint">상품명 또는 종목코드</span>
      </div>

      <div className="product-search">
        <label htmlFor={inputId}>상품 검색 및 선택</label>
        <div className="search-field-wrap">
          <Icon icon="search" size="md" aria-hidden="true" />
          <input
            ref={inputRef}
            id={inputId}
            role="combobox"
            aria-autocomplete="list"
            aria-haspopup="listbox"
            aria-controls={listId}
            aria-expanded={isOpen}
            aria-activedescendant={activeOption ? `${listId}-${activeOption.code}` : undefined}
            autoComplete="off"
            value={query}
            placeholder="상품명 또는 종목코드 검색"
            onChange={(event) => {
              setQuery(event.currentTarget.value);
              setIsOpen(true);
              setActiveIndex(-1);
            }}
            onFocus={() => {
              setIsOpen(true);
              setActiveIndex(-1);
            }}
            onBlur={() => setIsOpen(false)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown' && results.length > 0) {
                event.preventDefault();
                setIsOpen(true);
                setActiveIndex((current) => (current < 0 ? 0 : (current + 1) % results.length));
              } else if (event.key === 'ArrowUp' && results.length > 0) {
                event.preventDefault();
                setIsOpen(true);
                setActiveIndex((current) =>
                  current < 0
                    ? results.length - 1
                    : (current - 1 + results.length) % results.length,
                );
              } else if (event.key === 'Enter' && activeOption) {
                event.preventDefault();
                chooseProduct(activeOption.code);
              } else if (event.key === 'Home' && results.length > 0) {
                event.preventDefault();
                setIsOpen(true);
                setActiveIndex(0);
              } else if (event.key === 'End' && results.length > 0) {
                event.preventDefault();
                setIsOpen(true);
                setActiveIndex(results.length - 1);
              } else if (event.key === 'Escape') {
                setIsOpen(false);
              }
            }}
          />
        </div>

        {isOpen && results.length > 0 && (
          <div id={listId} className="product-results" role="listbox" aria-label="상품 검색 결과">
            {results.map((product, index) => (
              <button
                id={`${listId}-${product.code}`}
                type="button"
                role="option"
                aria-label={`${product.name}, ${product.code}, ${product.leverage > 0 ? `플러스 ${product.leverage}배` : `마이너스 ${Math.abs(product.leverage)}배`}, ${product.productType}, ${product.baseIndexType ? `일간 배수 산정 기준 ${baseIndexTypeLabel[product.baseIndexType]}` : ''}, ${analysisReferenceNoun(product)} ${product.underlyingName}, ${analysisReferenceLabel(product)}`}
                aria-selected={product.code === selectedCode}
                tabIndex={-1}
                className={`product-option ${index === activeIndex ? 'active' : ''}`}
                key={product.code}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => chooseProduct(product.code)}
              >
                <span className="product-option-main">
                  <strong>{product.name}</strong>
                  <span>{product.code}</span>
                </span>
                <span className="product-tags">
                  <span>
                    {product.leverage > 0 ? `+${product.leverage}X` : `${product.leverage}X`}
                  </span>
                  <span>{product.productType}</span>
                  <span>{analysisReferenceLabel(product)}</span>
                </span>
                <span className="product-underlying">
                  {product.baseIndexType &&
                    `배수 산정 ${baseIndexTypeLabel[product.baseIndexType]} · `}
                  {analysisReferenceNoun(product)} · {product.underlyingName}
                </span>
              </button>
            ))}
          </div>
        )}
        {isOpen && results.length === 0 && (
          <p className="empty-search" role="status">
            일치하는 지원 상품이 없습니다.
          </p>
        )}
        <p className="sr-only" role="status" aria-live="polite">
          {query ? `검색 결과 ${results.length}개` : ''}
        </p>
      </div>

      {selected && (
        <div className="selected-product" aria-live="polite">
          <span className={`leverage-mark ${selected.leverage < 0 ? 'inverse' : ''}`}>
            {selected.leverage > 0 ? `+${selected.leverage}X` : `${selected.leverage}X`}
          </span>
          <div>
            <strong>{selected.name}</strong>
            <p>
              <span className="product-code">{selected.code}</span> · {selected.productType} ·{' '}
              {selected.baseIndexType &&
                `배수 산정 ${baseIndexTypeLabel[selected.baseIndexType]} · `}
              {selected.underlyingName} · {analysisReferenceLabel(selected)}
            </p>
          </div>
        </div>
      )}
      {!selected && (
        <div className="selected-product selected-product--empty" role="status">
          <div>
            <strong>계산할 상품을 선택해 주세요.</strong>
            <p>지원 상품의 이름이나 종목코드로 검색할 수 있습니다.</p>
          </div>
        </div>
      )}
    </section>
  );
}
