import { Icon } from '@astryxdesign/core/Icon';
interface Props {
  stale: boolean;
  date: string;
  mismatch?: boolean;
}

export function DataFreshnessNotice({ stale, date, mismatch = false }: Props) {
  return (
    <>
      {import.meta.env.PUBLIC_DATA_MODE !== 'live' && (
        <div className="data-notice fixture-notice" role="status">
          <span aria-hidden="true">
            <Icon icon="info" size="sm" />
          </span>
          <strong>체험용 데이터 · 실제 시세가 아닙니다.</strong>
        </div>
      )}
      {stale ? (
        <div className="data-notice date-notice" role="status">
          <strong>{date} 종가 기준</strong>
        </div>
      ) : mismatch ? (
        <div className="data-notice" role="status">
          <span aria-hidden="true">
            <Icon icon="info" size="sm" />
          </span>
          <strong>데이터 기준일이 달라 공통 거래일까지 계산합니다.</strong>
        </div>
      ) : null}
    </>
  );
}
