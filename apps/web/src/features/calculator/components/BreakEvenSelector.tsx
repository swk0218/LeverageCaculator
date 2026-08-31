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
  const proxyDifference =
    product.baseIndexType === 'futures-index'
      ? '선물 베이시스와 롤오버'
      : product.baseIndexType === 'total-return-index'
        ? '배당 재투자'
        : '추적 방식';
  const direction = (scenario.cumulativeUnderlyingReturn ?? 0) >= 0 ? '상승' : '하락';
  const formatUnderlyingLevel = product.underlyingType === 'stock' ? formatWon : formatIndexPoints;
  const targetLabel = `본전까지 필요한 ${product.underlyingName} 가격`;
  const analysisDateLabel = analysisDate;

  return (
    <section className="break-even-panel" aria-labelledby="underlying-break-even-heading">
      <div className="panel-heading">
        <div>
          <h3 id="underlying-break-even-heading">{targetLabel}</h3>
          {isReferenceStockProxy && <span className="proxy-badge">본주 환산 참고</span>}
        </div>
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
        <div className="scenario-copy" aria-live="polite" aria-atomic="true">
          <strong>
            {scenario.targetUnderlyingPrice !== undefined
              ? `약 ${formatUnderlyingLevel(scenario.targetUnderlyingPrice)}`
              : formatPercent(scenario.cumulativeUnderlyingReturn)}
          </strong>
          {currentUnderlyingPrice !== undefined && scenario.targetUnderlyingPrice !== undefined && (
            <p className="target-change tabular">
              {analysisDateLabel ? `${analysisDateLabel} 종가 ` : '기준가 '}
              {formatUnderlyingLevel(currentUnderlyingPrice)}보다{' '}
              {formatPercent(scenario.cumulativeUnderlyingReturn)} · {selectedPeriod}거래일
            </p>
          )}
        </div>
      ) : (
        <div className="scenario-copy">
          <p>이 조건에서는 이론적인 본전 값을 계산할 수 없습니다.</p>
          <strong>{scenario.reason ?? '유효한 가격과 배수를 확인해 주세요.'}</strong>
        </div>
      )}

      <p className="target-note">
        {isReferenceStockProxy
          ? `본주 환산값 · ${proxyDifference} 차이로 실제와 다를 수 있습니다.`
          : `매일 같은 비율로 ${direction}하고 목표 배수를 따른다고 가정합니다.`}
      </p>
      <details className="assumption-details">
        <summary>계산 기준</summary>
        <p>
          {isReferenceStockProxy
            ? `${proxyDifference}는 반영하지 않습니다.`
            : `${directSubject}의 등락 경로와 상품 추적 성과에 따라 실제 결과는 달라질 수 있습니다.`}
          {analysisDateLabel ? ` 분석 기준일은 ${analysisDateLabel}입니다.` : ''}
        </p>
      </details>
    </section>
  );
}
