import { formatAveragePriceWon, formatQuantity, formatWon } from '@yangbok/core';

interface Props {
  averagePriceWon: number;
  totalQuantity: number;
  totalCostWon: number;
}

export function PurchaseSummary({ averagePriceWon, totalQuantity, totalCostWon }: Props) {
  return (
    <dl className="purchase-summary" aria-label="매수내역 자동 계산">
      <div>
        <dt>계산 평단</dt>
        <dd>{formatAveragePriceWon(averagePriceWon)}</dd>
      </div>
      <div>
        <dt>총수량</dt>
        <dd>{formatQuantity(totalQuantity)}</dd>
      </div>
      <div>
        <dt>총매수금액</dt>
        <dd>{formatWon(totalCostWon)}</dd>
      </div>
    </dl>
  );
}
