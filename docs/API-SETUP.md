# 실제 종목 데이터 연결

## 결론

기본 운영 경로는 Cloudflare가 아니라 **GitHub Pages + GitHub Actions 정적 데이터**다.
서비스키는 저장소의 Actions Secret `DATA_GO_KR_SERVICE_KEY`에만 두고, 평일 장 마감 후
15:40 KST에 workflow가 공식 가격을 수집·검증한다. 브라우저와 Pages bundle에는 서비스키가
들어가지 않는다.

Cloudflare Worker/D1은 요청 시점 API나 더 큰 동적 상품 범위가 필요할 때만 사용하는
선택적 대안이다.

## 1. 활용승인

공공데이터포털에서 다음 세 API를 활용신청한다.

- [금융위원회 주식시세정보](https://www.data.go.kr/data/15094808/openapi.do)
- [금융위원회 증권상품시세정보 — ETF/ETN](https://www.data.go.kr/data/15094806/openapi.do)
- [금융위원회 지수시세정보](https://www.data.go.kr/data/15094807/openapi.do)

현재 18개 운영 상품은 증권상품시세 API의 검증된 상품 종가만 사용하며 모두
`actual-only`다. 주식·지수 승인은 향후 정확한 기초자산 시계열이 입증된 상품을
`full` 분석으로 올릴 때 사용한다. 세 활용신청 화면의 일반 인증키가 같으면 하나의
Secret만 등록한다. adapter는 인코딩/디코딩 형태를 모두 정규화한다.

이 데이터는 실시간 시세가 아니다. 공식 응답의 `basDt`를 실제 거래 기준일로 사용하며,
workflow 실행일을 가격 기준일로 바꾸어 표시하지 않는다.

## 2. GitHub Pages 운영 연결

저장소 **Settings → Secrets and variables → Actions → New repository secret**에서 다음
Secret을 등록한다.

```text
Name: DATA_GO_KR_SERVICE_KEY
Value: 공공데이터포털 일반 인증키
```

값은 workflow 파일, `PUBLIC_*`, 커밋, 이슈, 채팅, 로그에 복사하지 않는다. GitHub는
Secret 값을 다시 보여주지 않으며 workflow에는 등록 여부와 이름만 사용한다.

`.github/workflows/pages.yml`은 다음 경우 실행된다.

- `main` push
- Actions 화면의 수동 실행
- 평일 15:40 KST (`06:40 UTC`) 예약 실행

`main` push나 수동 실행이 평일 15:40 전에 발생해도 생성기는 조회 종료일을 직전
평일로 제한한다. 토·일요일 실행은 직전 금요일까지만 조회한다. 따라서 예약 시각 외
실행도 진행 중인 장의 날짜를 가격 기준일로 취급하지 않는다.

`main` push나 수동 실행이 평일 15:40 전에 발생해도 생성기는 조회 종료일을 직전
평일로 제한한다. 토·일요일 실행은 직전 금요일까지만 조회한다. 따라서 예약 시각 외
실행도 진행 중인 장의 날짜를 가격 기준일로 취급하지 않는다.

수집 단계에만 Secret을 주입한다. 생성기는 활성 18개 상품 전부를 받아 schema와 코드,
비어 있지 않은 시계열, 최신값 일치 여부를 검증한 뒤 상품별 정적 JSON을 만든다. 하나라도
실패하면 build/upload/deploy가 실행되지 않아 직전 정상 Pages가 유지된다.

운영 build 공개값은 다음과 같다.

```text
RELEASE_TARGET=pages-static
PUBLIC_DATA_MODE=live
PUBLIC_SITE_URL=https://swk0218.github.io
PUBLIC_BASE_PATH=/LeverageCaculator
PUBLIC_API_BASE_URL=
PUBLIC_CONSENT_READY=false
```

`PUBLIC_API_BASE_URL`이 빈 값인 것은 의도적이다. 브라우저는 동일한 Pages origin의
`/LeverageCaculator/data/analysis/<종목코드>.json`을 읽는다.

## 3. 로컬에서 실제 응답 확인

키를 로컬에서 확인해야 할 때만 프로세스 환경에 일시적으로 넣고 생성기를 실행한다.
실제 키가 들어간 `.env`나 `.dev.vars`는 커밋하지 않는다.

```powershell
$env:DATA_GO_KR_SERVICE_KEY = '실제_키를_현재_프로세스에만_입력'
pnpm data:generate:pages -- --output-dir "$env:TEMP\yangbok-pages-data"
Remove-Item Env:DATA_GO_KR_SERVICE_KEY
```

기본 출력 경로는 `apps/web/public/data/analysis`이며 Git에서 제외된다. 임시 출력 경로를
사용하면 로컬 작업 트리를 오염시키지 않고 provider 응답과 생성 결과를 검사할 수 있다.

## 4. 선택적 Worker/D1 경로

요청 시점 API가 필요해 Cloudflare 경로를 선택한 경우에만 Worker secret을 등록한다.

```powershell
pnpm --dir=apps/worker exec wrangler secret put DATA_GO_KR_SERVICE_KEY --env production
pnpm --dir=apps/worker exec wrangler secret put BACKFILL_TOKEN --env production
```

이 경로는 D1 UUID, Worker 배포, 최초 backfill, CORS origin 설정이 추가로 필요하다. 전체
순서는 [배포 절차](./DEPLOY.md)의 선택적 Cloudflare 절을 따른다.

## 오류가 날 때

- `SERVICE_KEY_IS_NOT_REGISTERED_ERROR`: 활용신청 승인과 Secret 값을 확인한다.
- `PERMISSION_DENIED`: 요청 중인 API의 활용신청이 완료됐는지 확인한다.
- 빈 상품 시계열: 공식 데이터 제공 기준일과 종목코드, 호출 한도를 확인한다. 이전 정상
  Pages를 새 빈 데이터로 덮어쓰지 않는다.
- workflow 성공 후 화면이 이전 데이터: Pages deploy job과 JSON의 `stale.asOf`를 함께
  확인한다.

서비스키는 절대 GitHub Pages bundle, `PUBLIC_*`, 브라우저 네트워크 요청, 생성 JSON,
커밋 파일에 넣지 않는다.
