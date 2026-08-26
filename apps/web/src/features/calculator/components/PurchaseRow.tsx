import { useId } from 'react';

import type { PurchaseDraft, PurchaseDraftErrors } from '../types';

interface Props {
  index: number;
  draft: PurchaseDraft;
  errors: PurchaseDraftErrors;
  maxDate: string;
  minDate?: string;
  onChange: (id: string, field: keyof Omit<PurchaseDraft, 'id'>, value: string) => void;
  onRemove: (id: string) => void;
}

const digitsOnly = (value: string) => value.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '');

const formatIntegerInput = (value: string): string => {
  const digits = digitsOnly(value);
  return digits ? digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '';
};

export function PurchaseRow({ index, draft, errors, maxDate, minDate, onChange, onRemove }: Props) {
  const dateId = useId();
  const priceId = useId();
  const quantityId = useId();
  const dateErrorId = `${dateId}-error`;
  const priceErrorId = `${priceId}-error`;
  const quantityErrorId = `${quantityId}-error`;

  return (
    <fieldset className="purchase-row">
      <legend>매수 {index + 1}</legend>
      <div className="purchase-row-top">
        <div className={`field date-field ${errors.date ? 'field-error' : ''}`}>
          <label htmlFor={dateId}>매수일</label>
          <input
            id={dateId}
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
        <button
          className="remove-row"
          type="button"
          aria-label={`매수 ${index + 1} 삭제`}
          onClick={() => onRemove(draft.id)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 5 19 19M19 5 5 19" />
          </svg>
        </button>
      </div>
      <div className="purchase-values">
        <div className={`field ${errors.price ? 'field-error' : ''}`}>
          <label htmlFor={priceId}>매수가</label>
          <div className="unit-input">
            <input
              id={priceId}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              required
              value={draft.price}
              aria-invalid={Boolean(errors.price)}
              aria-describedby={errors.price ? priceErrorId : undefined}
              onChange={(event) =>
                onChange(draft.id, 'price', formatIntegerInput(event.currentTarget.value))
              }
            />
            <span>원</span>
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
              type="text"
              inputMode="numeric"
              autoComplete="off"
              required
              value={draft.quantity}
              aria-invalid={Boolean(errors.quantity)}
              aria-describedby={errors.quantity ? quantityErrorId : undefined}
              onChange={(event) =>
                onChange(draft.id, 'quantity', formatIntegerInput(event.currentTarget.value))
              }
            />
            <span>주</span>
          </div>
          {errors.quantity && (
            <span id={quantityErrorId} className="field-message" role="alert">
              {errors.quantity}
            </span>
          )}
        </div>
      </div>
    </fieldset>
  );
}
