import {
  formatDetailedPercent,
  formatPercent,
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
  const isReferenceStockProxy = product.analysisBasis === 'reference-stock-proxy';
  const proxyDifference =
    product.baseIndexType === 'futures-index'
      ? '선물 가격과 롤오버'
      : product.baseIndexType === 'total-return-index'
        ? '배당 재투자'
        : '추적 방식';
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
        <p className="target-note">이 매수분은 복리 분석 범위에 포함되지 않습니다.</p>
      </section>
    );
  }

  const values: ComparisonValue[] = [
    {
      label: `단순 ${product.leverage > 0 ? product.leverage : `-${Math.abs(product.leverage)}`}배`,
      value: result.simpleTheoreticalReturn,
    },
    { label: '일일 복리', value: result.dailyTheoreticalReturn },
    { label: '실제 상품', value: result.officialAnalysisReturn },
  ];
  const maxMagnitude = Math.max(...values.map((item) => Math.abs(item.value)), 0.01);
  const effectTone =
    result.compoundEffectWon > 0 ? 'positive' : result.compoundEffectWon < 0 ? 'negative' : '';
  const effectCopy =
    result.compoundEffectWon > 0
      ? `양의 복리로 ${formatPercent(Math.abs(result.compoundEffectRate), 1, false)}가 복사됐습니다.`
      : result.compoundEffectWon < 0
        ? `음의 복리로 ${formatPercent(Math.abs(result.compoundEffectRate), 1, false)}가 녹았습니다.`
        : '복리 차이 없음';

  return (
    <section className="comparison-panel" aria-labelledby="compound-heading">
      <div className="compound-summary">
        <div>
          <h3 id="compound-heading">복리효과</h3>
          <strong className={effectTone}>{effectCopy}</strong>
        </div>
      </div>
      {isReferenceStockProxy && <p className="proxy-note">본주 종가 기준 비교</p>}
      <details className="calculation-details">
        <summary>상세 비교</summary>
        <div className="calculation-details-body">
          <ul className="comparison-table" aria-label="단순 배수, 일일 복리, 실제 상품 비교">
            {values.map((item) => {
              const width = `${(Math.abs(item.value) / maxMagnitude) * 100}%`;
              return (
                <li className="comparison-row" key={item.label}>
                  <span className="comparison-label">{item.label}</span>
                  <div className="comparison-track" aria-hidden="true">
                    <div className="comparison-half">
                      {item.value < 0 && (
                        <span className="comparison-bar negative" style={{ width }} />
                      )}
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
          {result.theoreticalActualGapRate !== undefined && (
            <p className="gap-summary">
              실제 상품−이론 {formatPercentagePoints(result.theoreticalActualGapRate)} ·{' '}
              {formatWon(result.theoreticalActualGapWon ?? 0)}
            </p>
          )}
          <p className="assumption-note">
            복리효과와 전체 손익은 별개입니다. 실제−이론 차이에는 보수, 추적 차이, 시장가격 괴리와
            매수시점 차이가 포함될 수 있습니다.
            {isReferenceStockProxy
              ? ` ${product.underlyingName} 본주 종가로 환산했으며 ${proxyDifference}는 반영하지 않습니다.`
              : ''}
          </p>
        </div>
      </details>
    </section>
  );
}
