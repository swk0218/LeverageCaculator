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
      <div className="panel-heading">
        <h3 id="actual-detail-heading">현재 손익 상세</h3>
        <span className="section-hint">
          {usingManualPrice
            ? '직접 입력 현재가'
            : `${currentPriceDate.replaceAll('-', '.')} 공식 종가`}
        </span>
      </div>
      <dl>
        <div>
          <dt>계산 평단</dt>
          <dd>{formatAveragePriceWon(result.averagePriceWon)}</dd>
        </div>
        <div>
          <dt>총수량</dt>
          <dd>{formatQuantity(result.totalQuantity)}</dd>
        </div>
        <div>
          <dt>총매수금액</dt>
          <dd>{formatWon(result.totalCostWon)}</dd>
        </div>
        <div>
          <dt>현재 평가금액</dt>
          <dd>{formatWon(result.currentValueWon)}</dd>
        </div>
        <div>
          <dt>손익금액</dt>
          <dd>{formatWon(result.actualPnlWon)}</dd>
        </div>
        <div>
          <dt>현재 수익률</dt>
          <dd>{formatPercent(result.actualReturn)}</dd>
        </div>
      </dl>
    </section>
  );
}
