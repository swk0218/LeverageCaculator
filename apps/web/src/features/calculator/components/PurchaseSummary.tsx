import { formatAveragePriceWon, formatQuantity, formatWon } from '@yangbok/core';

interface Props {
  averagePriceWon: number;
  totalQuantity: number;
  totalCostWon: number;
  hasSales?: boolean;
  soldQuantity?: number;
  realizedPnlWon?: number;
}

export function PurchaseSummary({
  averagePriceWon,
  totalQuantity,
  totalCostWon,
  hasSales = false,
  soldQuantity = 0,
  realizedPnlWon = 0,
}: Props) {
  const isEmpty = totalQuantity === 0;

  return (
    <dl
      className={`purchase-summary ${hasSales ? 'purchase-summary--sales' : ''}`}
      aria-label={hasSales ? '거래내역 자동 계산' : '매수내역 자동 계산'}
    >
      <div>
        <dt>{hasSales ? '보유 평단' : '계산 평단'}</dt>
        <dd>{isEmpty ? '—' : formatAveragePriceWon(averagePriceWon)}</dd>
      </div>
      <div>
        <dt>{hasSales ? '현재 보유' : '총수량'}</dt>
        <dd>{isEmpty && !hasSales ? '—' : formatQuantity(totalQuantity)}</dd>
      </div>
      <div>
        <dt>총매수금액</dt>
        <dd>{totalCostWon === 0 ? '—' : formatWon(totalCostWon)}</dd>
      </div>
      {hasSales && (
        <div>
          <dt>실현손익 · {formatQuantity(soldQuantity)}</dt>
          <dd>{formatWon(realizedPnlWon)}</dd>
        </div>
      )}
    </dl>
  );
}
