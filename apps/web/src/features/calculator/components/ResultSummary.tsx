import { formatPercent, formatWon, type AnalysisResult } from '@yangbok/core';

interface Props {
  result: AnalysisResult;
}

const tone = (value: number | undefined) => {
  if (value === undefined || value === 0) return '';
  return value > 0 ? 'positive' : 'negative';
};

export function ResultSummary({ result }: Props) {
  const breakEvenDone = result.productBreakEvenReturn <= 0;

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
        <dt>상품 본전까지</dt>
        <dd>
          <span className={`primary-number ${breakEvenDone ? '' : 'condition'}`}>
            {breakEvenDone ? '본전 이상' : formatPercent(result.productBreakEvenReturn)}
          </span>
        </dd>
      </div>
    </dl>
  );
}
