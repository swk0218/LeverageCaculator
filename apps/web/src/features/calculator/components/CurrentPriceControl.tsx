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
  const helpId = `${inputId}-help`;
  const displayedManual = manualPrice ? Number(manualPrice.replaceAll(',', '')) : null;
  const usingManual =
    displayedManual !== null && Number.isSafeInteger(displayedManual) && displayedManual > 0;

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
              aria-label="직접 입력할 현재가 (원)"
              type="text"
              inputMode="numeric"
              autoFocus
              required
              value={draftPrice}
              aria-invalid={Boolean(error)}
              aria-describedby={`${helpId}${error ? ` ${errorId}` : ''}`}
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
          <p id={helpId} className="manual-price-help">
            적용하기 전까지 계산값은 바뀌지 않습니다.
          </p>
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
            {usingManual ? '현재가 다시 입력' : '현재가 수정'}
          </button>
          {usingManual && (
            <button type="button" className="text-button" onClick={onUseOfficial}>
              공식 종가로 되돌리기
            </button>
          )}
        </div>
      )}
    </section>
  );
}
