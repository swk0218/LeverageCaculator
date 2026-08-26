import { useId, useMemo, useState } from 'react';

import type { Product } from '@yangbok/core';

interface Props {
  products: Product[];
  selectedCode: string;
  onSelect: (code: string) => void;
}

const underlyingTypeLabel: Record<Product['underlyingType'], string> = {
  stock: '현물 주식',
  'spot-index': '현물 지수',
  'futures-index': '선물 지수',
};

export function ProductSearch({ products, selectedCode, onSelect }: Props) {
  const inputId = useId();
  const listId = useId();
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
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
    onSelect(code);
    setQuery('');
    setIsOpen(false);
    setActiveIndex(0);
  };

  const activeOption = isOpen ? results[activeIndex] : undefined;

  return (
    <section className="calculator-section product-section" aria-labelledby="product-heading">
      <div className="section-heading-row">
        <div>
          <p className="section-step pixel-label" aria-hidden="true">
            01
          </p>
          <h2 id="product-heading">상품</h2>
        </div>
        <span className="section-hint">상품명 또는 종목코드</span>
      </div>

      <div className="product-search">
        <label htmlFor={inputId}>상품 검색 및 선택</label>
        <div className="search-field-wrap">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4 4" />
          </svg>
          <input
            id={inputId}
            role="combobox"
            aria-autocomplete="list"
            aria-haspopup="listbox"
            aria-controls={listId}
            aria-expanded={isOpen}
            aria-activedescendant={activeOption ? `${listId}-${activeOption.code}` : undefined}
            autoComplete="off"
            value={query}
            placeholder={selected ? selected.name : '예: 삼성전자 또는 종목코드'}
            onChange={(event) => {
              setQuery(event.currentTarget.value);
              setIsOpen(true);
              setActiveIndex(0);
            }}
            onFocus={() => {
              setIsOpen(true);
              setActiveIndex(0);
            }}
            onBlur={() => setIsOpen(false)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown' && results.length > 0) {
                event.preventDefault();
                setIsOpen(true);
                setActiveIndex((current) => (current + 1) % results.length);
              } else if (event.key === 'ArrowUp' && results.length > 0) {
                event.preventDefault();
                setIsOpen(true);
                setActiveIndex((current) => (current - 1 + results.length) % results.length);
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
                aria-label={`${product.name}, ${product.code}, ${product.leverage > 0 ? `플러스 ${product.leverage}배` : `마이너스 ${Math.abs(product.leverage)}배`}`}
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
                  <span>{underlyingTypeLabel[product.underlyingType]}</span>
                </span>
                <span className="product-underlying">기초자산 · {product.underlyingName}</span>
              </button>
            ))}
          </div>
        )}
        {isOpen && results.length === 0 && (
          <p className="empty-search" role="status">
            일치하는 지원 상품이 없습니다.
          </p>
        )}
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
              {selected.underlyingName} · {underlyingTypeLabel[selected.underlyingType]}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
