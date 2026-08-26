import {
  formatDetailedPercent,
  formatPercentagePoints,
  formatWon,
  type AnalysisResult,
  type Product,
} from '@yangbok/core';

interface Props {
  product: Product;
  result: AnalysisResult;
}

interface ComparisonValue {
  label: string;
  value: number;
}

export function CompoundComparison({ product, result }: Props) {
  if (
    result.simpleTheoreticalPnlWon === undefined ||
    result.dailyTheoreticalPnlWon === undefined ||
    result.officialAnalysisPnlWon === undefined ||
    result.compoundEffectWon === undefined ||
    result.compoundEffectRate === undefined ||
    result.simpleTheoreticalReturn === undefined ||
    result.dailyTheoreticalReturn === undefined ||
    result.officialAnalysisReturn === undefined
  ) {
    return (
      <section className="comparison-panel" aria-labelledby="compound-heading">
        <div className="panel-heading">
          <h3 id="compound-heading">복리효과</h3>
        </div>
        <p className="assumption-note">
          {product.analysisCapability === 'actual-only'
            ? '이 상품은 정확한 기초자산 시계열이 검증되지 않아 실제 손익과 상품 자체 본전 조건만 제공합니다.'
            : '입력한 매수분 중 공식 분석일 기준으로 복리 분석 가능한 내역이 없어 실제 손익과 상품 자체 본전 조건만 제공합니다.'}
        </p>
      </section>
    );
  }

  const values: ComparisonValue[] = [
    {
      label: `단순 기간수익률 ×${product.leverage}`,
      value: result.simpleTheoreticalReturn,
    },
    { label: '일일 복리 이론값', value: result.dailyTheoreticalReturn },
    { label: '실제 상품 성과', value: result.officialAnalysisReturn },
  ];
  const maxMagnitude = Math.max(...values.map((item) => Math.abs(item.value)), 0.01);
  const effectCopy =
    result.compoundEffectWon > 0
      ? `일일 복리효과가 단순 배수보다 ${formatWon(result.compoundEffectWon)} 유리하게 작용했습니다.`
      : result.compoundEffectWon < 0
        ? `일일 복리효과가 단순 배수보다 ${formatWon(Math.abs(result.compoundEffectWon))} 불리하게 작용했습니다.`
        : '일일 복리효과와 단순 배수의 차이는 0원입니다.';

  return (
    <section className="comparison-panel" aria-labelledby="compound-heading">
      <div className="panel-heading">
        <h3 id="compound-heading">복리효과와 실제 상품 성과</h3>
        <span className="section-hint">
          {result.analysisDate?.replaceAll('-', '.')} 공식 분석 기준
        </span>
      </div>
      <ul className="comparison-table" aria-label="단순 배수, 일일 복리, 실제 상품 성과 비교">
        {values.map((item) => {
          const width = `${(Math.abs(item.value) / maxMagnitude) * 100}%`;
          return (
            <li className="comparison-row" key={item.label}>
              <span className="comparison-label">{item.label}</span>
              <div className="comparison-track" aria-hidden="true">
                <div className="comparison-half">
                  {item.value < 0 && <span className="comparison-bar negative" style={{ width }} />}
                </div>
                <div className="comparison-half">
                  {item.value >= 0 && (
                    <span className="comparison-bar positive" style={{ width }} />
                  )}
                </div>
              </div>
              <span className="comparison-value">{formatDetailedPercent(item.value)}</span>
            </li>
          );
        })}
      </ul>
      <div className="effect-callout">
        <strong>{effectCopy}</strong>
        <p>
          복리효과가 양수여도 전체 투자 손익이 이익이라는 뜻은 아닙니다. 두 개념을 따로 확인하세요.
        </p>
      </div>
      {result.theoreticalActualGapRate !== undefined && (
        <div className="effect-callout">
          <strong>
            이론값과 실제 상품 차이 {formatPercentagePoints(result.theoreticalActualGapRate)} ·{' '}
            {formatWon(result.theoreticalActualGapWon ?? 0)}
          </strong>
          <p>
            실제 매수시점과 종가의 차이, 보수, 추적 차이, 시장가격과 순자산가치의 괴리, 현물·선물
            차이와 기타 운용요인이 함께 섞인 값입니다.
          </p>
        </div>
      )}
    </section>
  );
}
