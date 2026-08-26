import { formatPercent, formatWon } from '@yangbok/core';
import type { BreakEvenScenario, Product } from '@yangbok/core';

interface Props {
  product: Product;
  scenario: BreakEvenScenario;
  selectedPeriod: number;
  currentUnderlyingPrice?: number;
  onPeriodChange: (period: number) => void;
}

export function BreakEvenSelector({
  product,
  scenario,
  selectedPeriod,
  currentUnderlyingPrice,
  onPeriodChange,
}: Props) {
  const subject = product.underlyingType === 'stock' ? '본주' : '기초지수';
  const direction = (scenario.cumulativeUnderlyingReturn ?? 0) >= 0 ? '상승' : '하락';

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
              <span>현재 {formatWon(currentUnderlyingPrice)}</span>
              <span>목표 약 {formatWon(scenario.targetUnderlyingPrice)}</span>
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
        선택한 기간 동안 기초자산이 일정하게 움직이고 상품이 목표 배수를 정확히 추종한다고 가정한
        이론값입니다. 실제 결과는 등락 경로와 상품 추적 성과에 따라 달라질 수 있습니다.
      </p>
    </section>
  );
}
