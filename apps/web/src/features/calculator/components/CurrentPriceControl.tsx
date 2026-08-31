import { useId } from 'react';

import { formatWon } from '@yangbok/core';

interface Props {
  officialPrice: number;
  officialDate: string;
  manualPrice: string | null;
  draftPrice: string;
  isEditing: boolean;
  error?: string;
  onEdit: () => void;
  onDraftPriceChange: (value: string) => void;
  onApply: () => void;
  onCancel: () => void;
  onUseOfficial: () => void;
}

const formatDate = (date: string) => date.replaceAll('-', '.');

export function CurrentPriceControl({
  officialPrice,
  officialDate,
  manualPrice,
  draftPrice,
  isEditing,
  error,
  onEdit,
  onDraftPriceChange,
  onApply,
  onCancel,
  onUseOfficial,
}: Props) {
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const displayedManual = manualPrice ? Number(manualPrice.replaceAll(',', '')) : null;
  const usingManual =
    displayedManual !== null && Number.isSafeInteger(displayedManual) && displayedManual > 0;

  return (
    <section className="current-price" aria-labelledby="current-price-heading">
      <div>
        <span id="current-price-heading" className="current-price-label">
          현재가
        </span>
        <strong className="tabular" aria-live="polite">
          {formatWon(usingManual && displayedManual !== null ? displayedManual : officialPrice)}
        </strong>
        <span className={`price-source ${usingManual ? 'manual' : ''}`}>
          {usingManual ? '직접 입력' : '공식 종가'}
        </span>
        <small>
          {usingManual
            ? `공식 종가 ${formatWon(officialPrice)} · ${formatDate(officialDate)} 참고`
            : `${formatDate(officialDate)} 종가`}
        </small>
      </div>
      {isEditing ? (
        <div className="manual-price-editor">
          <label htmlFor={inputId}>직접 입력할 현재가</label>
          <div className="unit-input">
            <input
              id={inputId}
              aria-label="직접 입력할 현재가 (원)"
              type="text"
              inputMode="numeric"
              autoFocus
              required
              value={draftPrice}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? errorId : undefined}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  if (!error && draftPrice) onApply();
                } else if (event.key === 'Escape') {
                  event.preventDefault();
                  onCancel();
                }
              }}
              onChange={(event) => {
                const digits = event.currentTarget.value
                  .replace(/[^0-9]/g, '')
                  .replace(/^0+(?=\d)/, '');
                onDraftPriceChange(digits ? digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '');
              }}
            />
            <span aria-hidden="true">원</span>
          </div>
          {error && (
            <span id={errorId} className="field-message" role="alert">
              {error}
            </span>
          )}
          <div className="manual-price-actions">
            <button
              type="button"
              className="apply-price-button"
              disabled={Boolean(error) || !draftPrice}
              onClick={onApply}
            >
              현재가 적용
            </button>
            <button type="button" className="text-button" onClick={onCancel}>
              취소
            </button>
          </div>
        </div>
      ) : (
        <div className="current-price-actions">
          <button type="button" className="outline-button" onClick={onEdit}>
            {usingManual ? '가격 다시 입력' : '가격 직접 입력'}
          </button>
          {usingManual && (
            <button type="button" className="text-button" onClick={onUseOfficial}>
              종가로 복원
            </button>
          )}
        </div>
      )}
    </section>
  );
}
