interface Props {
  mode: 'fixture' | 'live';
  stale: boolean;
  date: string;
  mismatch?: boolean;
}

export function DataFreshnessNotice({ mode, stale, date, mismatch = false }: Props) {
  return (
    <>
      {import.meta.env.PUBLIC_DATA_MODE !== 'live' && mode === 'fixture' && (
        <div className="data-notice fixture-notice" role="status">
          <span aria-hidden="true">◆</span>
          <div>
            <strong>Fixture 데이터로 확인 중</strong>
            <p>외부 API 없이 제품 흐름을 검증하는 개발·미리보기 모드입니다.</p>
          </div>
        </div>
      )}
      {import.meta.env.PUBLIC_DATA_MODE === 'live' && !stale && !mismatch && date && (
        <div className="data-notice live-notice" role="status">
          <span aria-hidden="true">✓</span>
          <div>
            <strong>공식 데이터 연결됨</strong>
            <p>{date.replaceAll('-', '.')} 기준 상품·기초자산 시계열을 사용합니다.</p>
          </div>
        </div>
      )}
      {stale ? (
        <div className="data-notice stale-notice" role="status">
          <span aria-hidden="true">!</span>
          <div>
            <strong>가격 데이터 갱신이 지연되고 있습니다.</strong>
            <p>{date.replaceAll('-', '.')} 공식 종가까지 제공됩니다. 기준일을 확인해 주세요.</p>
          </div>
        </div>
      ) : mismatch ? (
        <div className="data-notice" role="status">
          <span aria-hidden="true">i</span>
          <div>
            <strong>상품과 기초자산의 최신 날짜가 다릅니다.</strong>
            <p>두 시계열이 모두 존재하는 최신 공통 거래일까지만 복리 분석합니다.</p>
          </div>
        </div>
      ) : null}
    </>
  );
}
