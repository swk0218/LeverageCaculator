import {
  formatPercent,
  formatPercentagePoints,
  formatWon,
  type AnalysisResult,
  type BreakEvenScenario,
  type Product,
} from '@yangbok/core';

interface Props {
  product: Product;
  result: AnalysisResult;
  scenario?: BreakEvenScenario;
  selectedPeriod: number;
  usingManualPrice: boolean;
}

const tone = (value: number | undefined) => {
  if (value === undefined || value === 0) return '';
  return value > 0 ? 'positive' : 'negative';
};

export function ResultSummary({
  product,
  result,
  scenario,
  selectedPeriod,
  usingManualPrice,
}: Props) {
  const subject =
    product.analysisBasis === 'reference-stock-proxy'
      ? '본주 환산'
      : product.underlyingType === 'stock'
        ? '본주'
        : '기초지수';
  const productLabel = product.productType;
  const hasFullAnalysis = product.analysisCapability === 'full';
  const breakEvenDone = result.productBreakEvenReturn <= 0;
  const scenarioValue = scenario?.cumulativeUnderlyingReturn;

  return (
    <dl className={`result-summary ${hasFullAnalysis ? '' : 'actual-only'}`}>
      <div className="result-metric">
        <dt>현재 수익률</dt>
        <dd>
          <span className={`primary-number ${tone(result.actualReturn)}`}>
            {formatPercent(result.actualReturn)}
          </span>
          <small>
            {formatWon(result.actualPnlWon)} · {usingManualPrice ? '직접 입력 현재가' : '공식 종가'}{' '}
            반영
          </small>
        </dd>
      </div>
      <div className="result-metric">
        <dt>{productLabel} 본전까지</dt>
        <dd>
          <span className={`primary-number ${breakEvenDone ? '' : 'condition'}`}>
            {breakEvenDone ? '평단 이상' : formatPercent(result.productBreakEvenReturn)}
          </span>
          <small>
            {breakEvenDone
              ? '현재 가격이 계산 평단 이상입니다.'
              : '현재 상품 가격에서 올라야 하는 비율'}
          </small>
        </dd>
      </div>
      {hasFullAnalysis && (
        <>
          <div className="result-metric result-metric--theory">
            <dt>{subject} 본전 조건</dt>
            <dd>
              <span className="primary-number condition">
                {scenario?.isPossible && scenarioValue !== undefined
                  ? formatPercent(scenarioValue)
                  : '분석 불가'}
              </span>
              <small>{selectedPeriod}거래일 균등 움직임 가정</small>
            </dd>
          </div>
          <div className="result-metric result-metric--theory">
            <dt>
              {product.analysisBasis === 'reference-stock-proxy'
                ? '본주 환산 복리효과'
                : '복리효과'}
            </dt>
            <dd>
              <span className={`primary-number ${tone(result.compoundEffectRate)}`}>
                {result.compoundEffectRate === undefined
                  ? '분석 불가'
                  : formatPercentagePoints(result.compoundEffectRate)}
              </span>
              <small>
                {result.compoundEffectWon === undefined
                  ? '기초자산 분석 범위를 확인해 주세요.'
                  : formatWon(result.compoundEffectWon)}
              </small>
            </dd>
          </div>
        </>
      )}
    </dl>
  );
}
