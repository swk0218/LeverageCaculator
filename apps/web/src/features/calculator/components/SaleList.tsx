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
    <section className="calculator-section sale-list-section" aria-labelledby="sale-heading">
      <div className="section-heading-row">
        <div>
          <h2 id="sale-heading">매도내역</h2>
        </div>
        <span className="section-hint">중간 매도는 선택 입력</span>
      </div>
      <p className="section-description">매도일·매도가·수량을 입력하면 실현손익에 반영합니다.</p>
      <details className="sale-calculation-details">
        <summary>매도 계산 기준</summary>
        <p>먼저 산 매수분부터 차감합니다. 같은 날짜 매도는 입력한 순서대로 계산합니다.</p>
      </details>
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
    </section>
  );
}
