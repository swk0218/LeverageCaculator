import { useId } from 'react';

import { formatWon } from '@yangbok/core';

interface Props {
  officialPrice: number;
  officialDate: string;
  manualPrice: string | null;
  isEditing: boolean;
  error?: string;
  onEdit: () => void;
  onManualPriceChange: (value: string) => void;
  onUseOfficial: () => void;
}

const formatDate = (date: string) => date.replaceAll('-', '.');

export function CurrentPriceControl({
  officialPrice,
  officialDate,
  manualPrice,
  isEditing,
  error,
  onEdit,
  onManualPriceChange,
  onUseOfficial,
}: Props) {
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const displayedManual = manualPrice ? Number(manualPrice.replaceAll(',', '')) : null;
  const usingManual =
    !error &&
    displayedManual !== null &&
    Number.isSafeInteger(displayedManual) &&
    displayedManual > 0;

  return (
    <section className="current-price" aria-labelledby="current-price-heading">
      <div>
        <h3 id="current-price-heading">현재가</h3>
        <strong className="tabular" aria-live="polite">
          {formatWon(usingManual && displayedManual !== null ? displayedManual : officialPrice)}
        </strong>
        <span className={`price-source ${usingManual ? 'manual' : ''}`}>
          {usingManual ? '직접 입력' : '공식 종가'}
        </span>
        <small>
          {usingManual
            ? `현재 손익·본전 계산에 사용 · ${formatDate(officialDate)} 공식 상품 종가 시계열 유지`
            : `${formatDate(officialDate)} 공식 종가 기준`}
        </small>
      </div>
      {isEditing ? (
        <div className="manual-price-editor">
          <label htmlFor={inputId}>직접 입력할 현재가</label>
          <div className="unit-input">
            <input
              id={inputId}
              type="text"
              inputMode="numeric"
              autoFocus
              required
              value={manualPrice ?? ''}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? errorId : undefined}
              onChange={(event) => {
                const digits = event.currentTarget.value
                  .replace(/[^0-9]/g, '')
                  .replace(/^0+(?=\d)/, '');
                onManualPriceChange(digits ? digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '');
              }}
            />
            <span>원</span>
          </div>
          {error && (
            <span id={errorId} className="field-message" role="alert">
              {error}
            </span>
          )}
          <button type="button" className="text-button" onClick={onUseOfficial}>
            공식 가격 사용
          </button>
        </div>
      ) : (
        <button type="button" className="outline-button" onClick={onEdit}>
          현재가 수정
        </button>
      )}
    </section>
  );
}
