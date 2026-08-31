import { formatPercent, formatQuantity, formatWon, type AnalysisResult } from '@yangbok/core';

interface Props {
  result: AnalysisResult;
}

const tone = (value: number | undefined) => {
  if (value === undefined || value === 0) return '';
  return value > 0 ? 'positive' : 'negative';
};

export function ResultSummary({ result }: Props) {
  const hasSales = result.soldQuantity > 0;
  const breakEvenDone = result.productBreakEvenReturn <= 0;
  const breakEvenClass = breakEvenDone ? '' : `condition ${tone(result.productBreakEvenReturn)}`;

  if (hasSales) {
    const positionClosed = result.totalQuantity === 0;
    return (
      <dl className="result-summary result-summary--sales">
        <div className="result-metric">
          <dt>총 손익</dt>
          <dd>
            <span className={`primary-number ${tone(result.actualPnlWon)}`}>
              {formatWon(result.actualPnlWon)}
            </span>
            <small>{formatPercent(result.actualReturn)}</small>
          </dd>
        </div>
        <div className="result-metric">
          <dt>실현손익</dt>
          <dd>
            <span className={`primary-number ${tone(result.realizedPnlWon)}`}>
              {formatWon(result.realizedPnlWon)}
            </span>
            <small>{formatWon(result.totalSaleProceedsWon)} 매도금액</small>
          </dd>
        </div>
        <div className="result-metric">
          <dt>보유손익 · {formatQuantity(result.totalQuantity)}</dt>
          <dd>
            <span className={`primary-number ${tone(result.unrealizedPnlWon)}`}>
              {formatWon(result.unrealizedPnlWon)}
            </span>
            <small>{positionClosed ? '현재 보유 없음' : '현재가 기준'}</small>
          </dd>
        </div>
        <div className="result-metric">
          <dt>보유분 본전 필요 수익률</dt>
          <dd>
            <span className={`primary-number ${positionClosed ? '' : breakEvenClass}`}>
              {positionClosed ? '포지션 종료' : formatPercent(result.productBreakEvenReturn)}
            </span>
          </dd>
        </div>
      </dl>
    );
  }

  return (
    <dl className="result-summary">
      <div className="result-metric">
        <dt>내 수익률</dt>
        <dd>
          <span className={`primary-number ${tone(result.actualReturn)}`}>
            {formatPercent(result.actualReturn)}
          </span>
          <small>{formatWon(result.actualPnlWon)}</small>
        </dd>
      </div>
      <div className="result-metric">
        <dt>본전 필요 수익률</dt>
        <dd>
          <span className={`primary-number ${breakEvenClass}`}>
            {breakEvenDone ? '본전 이상' : formatPercent(result.productBreakEvenReturn)}
          </span>
        </dd>
      </div>
    </dl>
  );
}
