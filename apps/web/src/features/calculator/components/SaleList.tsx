import type { SaleDraft, SaleDraftErrors } from '../types';
import { SaleRow } from './SaleRow';

interface Props {
  drafts: SaleDraft[];
  errors: Record<string, SaleDraftErrors>;
  availableQuantities: Record<string, number>;
  focusDraftId: string | null;
  maxDate: string;
  minDate?: string;
  onChange: (id: string, field: keyof Omit<SaleDraft, 'id'>, value: string) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
}

export function SaleList({
  drafts,
  errors,
  availableQuantities,
  focusDraftId,
  maxDate,
  minDate,
  onChange,
  onRemove,
  onAdd,
}: Props) {
  return (
    <div className="sale-list-section sale-entry">
      {drafts.length > 0 && (
        <div className="purchase-list">
          {drafts.map((draft, index) => (
            <SaleRow
              key={draft.id}
              index={index}
              draft={draft}
              errors={errors[draft.id] ?? {}}
              availableQuantity={availableQuantities[draft.id] ?? 0}
              canRemove={drafts.length > 1}
              focusOnMount={draft.id === focusDraftId}
              maxDate={maxDate}
              minDate={minDate}
              onChange={onChange}
              onRemove={onRemove}
            />
          ))}
        </div>
      )}
      <button
        className="add-purchase add-sale"
        type="button"
        disabled={drafts.length >= 50}
        onClick={onAdd}
      >
        매도내역 추가
        {drafts.length > 0 && (
          <span>{drafts.length >= 50 ? '최대 50개' : `${drafts.length}개 입력 중`}</span>
        )}
      </button>
    </div>
  );
}
