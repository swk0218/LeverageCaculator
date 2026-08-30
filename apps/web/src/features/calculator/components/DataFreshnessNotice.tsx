import { Icon } from '@astryxdesign/core/Icon';
import type { Product } from '@yangbok/core';

interface Props {
  analysisCapability: Product['analysisCapability'];
  stale: boolean;
  date: string;
  mismatch?: boolean;
}

export function DataFreshnessNotice({ analysisCapability, stale, date, mismatch = false }: Props) {
  return (
    <>
      {import.meta.env.PUBLIC_DATA_MODE !== 'live' && (
        <div className="data-notice fixture-notice" role="status">
          <span aria-hidden="true">
            <Icon icon="info" size="sm" />
          </span>
          <div>
            <strong>체험용 데이터 사용 중</strong>
            <p>기능을 확인하기 위한 예시 값이며 실제 시세가 아닙니다.</p>
          </div>
        </div>
      )}
      {import.meta.env.PUBLIC_DATA_MODE === 'live' && !stale && !mismatch && date && (
        <div className="data-notice live-notice" role="status">
          <span aria-hidden="true">
            <Icon icon="success" size="sm" />
          </span>
          <div>
            <strong>공식 상품 종가 연결됨</strong>
            <p>
              {analysisCapability === 'full'
                ? `${date.replaceAll('-', '.')} 기준 상품·기초자산 시계열을 사용합니다.`
                : `${date.replaceAll('-', '.')} 기준 상품 종가를 사용합니다. 기초자산 복리분석은 현재 지원하지 않습니다.`}
            </p>
          </div>
        </div>
      )}
      {stale ? (
        <div className="data-notice stale-notice" role="status">
          <span aria-hidden="true">
            <Icon icon="warning" size="sm" />
          </span>
          <div>
            <strong>가격 데이터 갱신이 지연되고 있습니다.</strong>
            <p>{date.replaceAll('-', '.')} 공식 종가까지 제공됩니다. 기준일을 확인해 주세요.</p>
          </div>
        </div>
      ) : mismatch ? (
        <div className="data-notice" role="status">
          <span aria-hidden="true">
            <Icon icon="info" size="sm" />
          </span>
          <div>
            <strong>상품과 기초자산의 최신 날짜가 다릅니다.</strong>
            <p>두 시계열이 모두 존재하는 최신 공통 거래일까지만 복리 분석합니다.</p>
          </div>
        </div>
      ) : null}
    </>
  );
}
