import {
  formatAveragePriceWon,
  formatPercent,
  formatQuantity,
  formatWon,
  type AnalysisResult,
} from '@yangbok/core';

interface Props {
  result: AnalysisResult;
  currentPriceDate: string;
  usingManualPrice: boolean;
}

export function ActualDetail({ result, currentPriceDate, usingManualPrice }: Props) {
  return (
    <section className="actual-detail" aria-labelledby="actual-detail-heading">
      <details>
        <summary>
          <span id="actual-detail-heading">손익 상세</span>
          <small>{usingManualPrice ? '직접 입력가' : `${currentPriceDate} 종가`}</small>
        </summary>
        <dl>
          <div>
            <dt>{result.soldQuantity > 0 ? '보유 평단' : '계산 평단'}</dt>
            <dd>
              {result.totalQuantity > 0 ? formatAveragePriceWon(result.averagePriceWon) : '—'}
            </dd>
          </div>
          <div>
            <dt>{result.soldQuantity > 0 ? '현재 보유' : '총수량'}</dt>
            <dd>{formatQuantity(result.totalQuantity)}</dd>
          </div>
          <div>
            <dt>총매수금액</dt>
            <dd>{formatWon(result.totalCostWon)}</dd>
          </div>
          {result.soldQuantity > 0 && (
            <>
              <div>
                <dt>매도수량</dt>
                <dd>{formatQuantity(result.soldQuantity)}</dd>
              </div>
              <div>
                <dt>실현손익</dt>
                <dd>{formatWon(result.realizedPnlWon)}</dd>
              </div>
              <div>
                <dt>매도금액</dt>
                <dd>{formatWon(result.totalSaleProceedsWon)}</dd>
              </div>
            </>
          )}
          <div>
            <dt>현재 평가금액</dt>
            <dd>{formatWon(result.currentValueWon)}</dd>
          </div>
          {result.soldQuantity > 0 && (
            <div>
              <dt>보유손익</dt>
              <dd>{formatWon(result.unrealizedPnlWon)}</dd>
            </div>
          )}
          <div>
            <dt>{result.soldQuantity > 0 ? '총 손익' : '손익금액'}</dt>
            <dd>{formatWon(result.actualPnlWon)}</dd>
          </div>
          <div>
            <dt>현재 수익률</dt>
            <dd>{formatPercent(result.actualReturn)}</dd>
          </div>
        </dl>
      </details>
    </section>
  );
}
