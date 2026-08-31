import type { ReactNode } from 'react';
import type { PurchaseDraft, PurchaseDraftErrors } from '../types';
import { PurchaseRow } from './PurchaseRow';

interface Props {
  drafts: PurchaseDraft[];
  errors: Record<string, PurchaseDraftErrors>;
  focusDraftId: string | null;
  maxDate: string;
  minDate?: string;
  onChange: (id: string, field: keyof Omit<PurchaseDraft, 'id'>, value: string) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
  afterAdd?: ReactNode;
}

export function PurchaseList({
  drafts,
  errors,
  focusDraftId,
  maxDate,
  minDate,
  onChange,
  onRemove,
  onAdd,
  afterAdd,
}: Props) {
  return (
    <section className="calculator-section" aria-labelledby="purchase-heading">
      <div className="section-heading-row">
        <div>
          <h2 id="purchase-heading">매수내역</h2>
        </div>
        <span className="section-hint">보유분만 입력</span>
      </div>
      <div className="purchase-list">
        {drafts.map((draft, index) => (
          <PurchaseRow
            key={draft.id}
            index={index}
            draft={draft}
            errors={errors[draft.id] ?? {}}
            canRemove={drafts.length > 1}
            focusOnMount={draft.id === focusDraftId}
            maxDate={maxDate}
            minDate={minDate}
            onChange={onChange}
            onRemove={onRemove}
          />
        ))}
      </div>
      <button className="add-purchase" type="button" disabled={drafts.length >= 50} onClick={onAdd}>
        매수내역 추가
        {drafts.length > 1 && (
          <span>{drafts.length >= 50 ? '최대 50개' : `${drafts.length}개 입력 중`}</span>
        )}
      </button>
      {afterAdd}
    </section>
  );
}
