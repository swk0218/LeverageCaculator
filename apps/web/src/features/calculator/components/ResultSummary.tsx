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
  const breakEvenClass = breakEvenDone ? '' : `condition ${tone(result.productBreakEvenReturn)}`;

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
