import { useEffect, useId, useRef } from 'react';

import { Icon } from '@astryxdesign/core/Icon';
import type { SaleDraft, SaleDraftErrors } from '../types';

interface Props {
  index: number;
  draft: SaleDraft;
  errors: SaleDraftErrors;
  canRemove: boolean;
  focusOnMount: boolean;
  maxDate: string;
  minDate?: string;
  availableQuantity: number;
  onChange: (id: string, field: keyof Omit<SaleDraft, 'id'>, value: string) => void;
  onRemove: (id: string) => void;
}

const digitsOnly = (value: string) => value.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '');

const formatIntegerInput = (value: string): string => {
  const digits = digitsOnly(value);
  return digits ? digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '';
};

export function SaleRow({
  index,
  draft,
  errors,
  canRemove,
  focusOnMount,
  maxDate,
  minDate,
  availableQuantity,
  onChange,
  onRemove,
}: Props) {
  const dateId = useId();
  const priceId = useId();
  const quantityId = useId();
  const dateErrorId = `${dateId}-error`;
  const priceErrorId = `${priceId}-error`;
  const quantityErrorId = `${quantityId}-error`;
  const availabilityId = `${quantityId}-available`;
  const dateInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (focusOnMount) dateInputRef.current?.focus();
  }, [focusOnMount]);

  return (
    <fieldset className="purchase-row sale-row" data-sale-id={draft.id}>
      <legend>매도 {index + 1}</legend>
      <div className={`purchase-row-grid ${canRemove ? '' : 'single-row'}`}>
        <div className={`field date-field ${errors.date ? 'field-error' : ''}`}>
          <label htmlFor={dateId}>매도일</label>
          <input
            id={dateId}
            ref={dateInputRef}
            type="date"
            min={minDate}
            max={maxDate}
            required
            value={draft.date}
            aria-invalid={Boolean(errors.date)}
            aria-describedby={errors.date ? dateErrorId : undefined}
            onChange={(event) => onChange(draft.id, 'date', event.currentTarget.value)}
          />
          {errors.date && (
            <span id={dateErrorId} className="field-message" role="alert">
              {errors.date}
            </span>
          )}
        </div>
        <div className="purchase-values">
          <div className={`field ${errors.price ? 'field-error' : ''}`}>
            <label htmlFor={priceId}>매도가</label>
            <div className="unit-input">
              <input
                id={priceId}
                aria-label="매도가 (원)"
                type="text"
                inputMode="numeric"
                enterKeyHint="next"
                autoComplete="off"
                required
                value={draft.price}
                aria-invalid={Boolean(errors.price)}
                aria-describedby={errors.price ? priceErrorId : undefined}
                onChange={(event) =>
                  onChange(draft.id, 'price', formatIntegerInput(event.currentTarget.value))
                }
              />
              <span aria-hidden="true">원</span>
            </div>
            {errors.price && (
              <span id={priceErrorId} className="field-message" role="alert">
                {errors.price}
              </span>
            )}
          </div>
          <div className={`field ${errors.quantity ? 'field-error' : ''}`}>
            <label htmlFor={quantityId}>수량</label>
            <div className="unit-input">
              <input
                id={quantityId}
                aria-label="매도 수량 (주)"
                type="text"
                inputMode="numeric"
                enterKeyHint="done"
                autoComplete="off"
                required
                value={draft.quantity}
                aria-invalid={Boolean(errors.quantity)}
                aria-describedby={
                  [errors.quantity ? quantityErrorId : '', availabilityId]
                    .filter(Boolean)
                    .join(' ') || undefined
                }
                onChange={(event) =>
                  onChange(draft.id, 'quantity', formatIntegerInput(event.currentTarget.value))
                }
              />
              <span aria-hidden="true">주</span>
            </div>
            <span id={availabilityId} className="sale-availability" aria-live="polite">
              매도 가능 {availableQuantity.toLocaleString('ko-KR')}주
            </span>
            {errors.quantity && (
              <span id={quantityErrorId} className="field-message" role="alert">
                {errors.quantity}
              </span>
            )}
          </div>
        </div>
        {canRemove && (
          <button
            className="remove-row"
            type="button"
            aria-label={`매도 ${index + 1} 삭제`}
            onClick={() => onRemove(draft.id)}
          >
            <Icon icon="close" size="md" aria-hidden="true" />
          </button>
        )}
      </div>
    </fieldset>
  );
}
