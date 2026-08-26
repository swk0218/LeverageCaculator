import type { PurchaseDraft, PurchaseDraftErrors } from '../types';
import { PurchaseRow } from './PurchaseRow';

interface Props {
  drafts: PurchaseDraft[];
  errors: Record<string, PurchaseDraftErrors>;
  maxDate: string;
  minDate?: string;
  onChange: (id: string, field: keyof Omit<PurchaseDraft, 'id'>, value: string) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
}

export function PurchaseList({
  drafts,
  errors,
  maxDate,
  minDate,
  onChange,
  onRemove,
  onAdd,
}: Props) {
  return (
    <section className="calculator-section" aria-labelledby="purchase-heading">
      <div className="section-heading-row">
        <div>
          <p className="section-step pixel-label" aria-hidden="true">
            02
          </p>
          <h2 id="purchase-heading">매수내역</h2>
        </div>
        <span className="section-hint">현재 보유 중인 매수분만 입력</span>
      </div>
      <div className="purchase-list">
        {drafts.map((draft, index) => (
          <PurchaseRow
            key={draft.id}
            index={index}
            draft={draft}
            errors={errors[draft.id] ?? {}}
            maxDate={maxDate}
            minDate={minDate}
            onChange={onChange}
            onRemove={onRemove}
          />
        ))}
      </div>
      <button className="add-purchase" type="button" disabled={drafts.length >= 50} onClick={onAdd}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 4v16M4 12h16" />
        </svg>
        추가 매수
        <span>{drafts.length}/50</span>
      </button>
    </section>
  );
}
