import { formatIndexPoints, formatPercent, formatWon } from '@yangbok/core';
import type { BreakEvenScenario, Product } from '@yangbok/core';

interface Props {
  product: Product;
  scenario: BreakEvenScenario;
  selectedPeriod: number;
  currentUnderlyingPrice?: number;
  analysisDate?: string;
  onPeriodChange: (period: number) => void;
}

export function BreakEvenSelector({
  product,
  scenario,
  selectedPeriod,
  currentUnderlyingPrice,
  analysisDate,
  onPeriodChange,
}: Props) {
  const isReferenceStockProxy = product.analysisBasis === 'reference-stock-proxy';
  const directSubject = product.underlyingType === 'stock' ? '본주' : '기초지수';
  const subject = isReferenceStockProxy ? '본주 환산 참고' : directSubject;
  const proxyDifference =
    product.baseIndexType === 'futures-index'
      ? '선물 베이시스와 롤오버'
      : product.baseIndexType === 'total-return-index'
        ? '배당 재투자'
        : '추적 방식';
  const direction = (scenario.cumulativeUnderlyingReturn ?? 0) >= 0 ? '상승' : '하락';
  const formatUnderlyingLevel = product.underlyingType === 'stock' ? formatWon : formatIndexPoints;

  return (
    <section className="break-even-panel" aria-labelledby="underlying-break-even-heading">
      <div className="panel-heading">
        <h3 id="underlying-break-even-heading">{subject} 본전 조건</h3>
        <fieldset className="period-selector">
          <legend className="sr-only">본전 조건 기간</legend>
          {[1, 5, 20].map((period) => (
            <label key={period}>
              <input
                type="radio"
                name="break-even-period"
                value={period}
                checked={selectedPeriod === period}
                onChange={() => onPeriodChange(period)}
              />
              <span>{period}거래일</span>
            </label>
          ))}
        </fieldset>
      </div>

      {scenario.isPossible && scenario.cumulativeUnderlyingReturn !== undefined ? (
        <div className="scenario-copy">
          <p>
            {selectedPeriod}거래일 동안 같은 비율로 {direction}한다면
          </p>
          <strong>
            {product.underlyingName} 약 {formatPercent(scenario.cumulativeUnderlyingReturn)}
          </strong>
          {currentUnderlyingPrice !== undefined && scenario.targetUnderlyingPrice !== undefined && (
            <div className="underlying-prices tabular">
              <span>
                {analysisDate ? `${analysisDate.replaceAll('-', '.')} 종가` : '분석 기준가'}{' '}
                {formatUnderlyingLevel(currentUnderlyingPrice)}
              </span>
              <span>목표 약 {formatUnderlyingLevel(scenario.targetUnderlyingPrice)}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="scenario-copy">
          <p>이 조건에서는 이론적인 본전 값을 계산할 수 없습니다.</p>
          <strong>{scenario.reason ?? '유효한 가격과 배수를 확인해 주세요.'}</strong>
        </div>
      )}

      <p className="assumption-note">
        {isReferenceStockProxy
          ? `${product.underlyingName} 본주가 선택한 기간 동안 일정하게 움직이고 상품이 목표 배수를 정확히 반영한다고 가정한 환산 참고값입니다. 일간 배수 산정 기준인 ${product.baseIndexName ?? '상품 원지수'}와 본주 사이의 ${proxyDifference} 차이 때문에 실제 본전 조건과 달라질 수 있습니다.`
          : `선택한 기간 동안 ${directSubject}가 일정하게 움직이고 상품이 목표 배수를 정확히 추종한다고 가정한 이론값입니다. 실제 결과는 등락 경로와 상품 추적 성과에 따라 달라질 수 있습니다.`}
      </p>
    </section>
  );
}
