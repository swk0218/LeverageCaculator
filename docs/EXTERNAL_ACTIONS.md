# External Actions

코드와 로컬 검증으로 대체할 수 없는 작업만 남아 있다. 아래 항목은 실제 계정과
secret을 가진 사용자가 수행해야 하며, 완료 전에는 운영 배포를 완료했다고 표시하지 않는다.

## 1. 공공데이터포털 service key

- 수행 위치: 공공데이터포털의 [주식시세정보](https://www.data.go.kr/data/15094808/openapi.do),
  [증권상품시세정보](https://www.data.go.kr/data/15094806/openapi.do),
  [시장지수시세정보](https://www.data.go.kr/data/15094807/openapi.do) 활용신청 화면
- 필요한 값: 승인된 `DATA_GO_KR_SERVICE_KEY`
- 등록: GitHub 저장소 **Settings → Secrets and variables → Actions**의 repository Secret
- 현재 증거: 2026-08-30 `DATA_GO_KR_SERVICE_KEY` 이름과 갱신 시각을 GitHub API로 확인함.
  값은 조회하지 않았고 조회할 수도 없다.
- 성공 확인: Actions 생성 step이 18개 상품을 모두 검증하고 Pages artifact의 대표
  `/data/analysis/<종목코드>.json`이 실제 거래 기준일을 반환
- 실패 확인: 활용 승인 상태, 키 인코딩 형식, 일일 호출 한도, operation URL, Worker log의
  안전한 오류 code를 확인한다. 키나 upstream 전체 URL을 로그에 복사하지 않는다.

## 2. 선택 사항: Cloudflare 계정, API 권한, D1

- 수행 위치: Cloudflare Dashboard 또는 Wrangler
- 필요한 값: 계정, Workers/Pages/D1 권한, D1 UUID, 필요 시 API token/account ID
- 실행: `pnpm --dir=apps/worker exec wrangler d1 create yangbok-eumbok --location=apac`
- 반영: `apps/worker/wrangler.jsonc`의 production D1 ID와 production origin을 실제 값으로
  교체. 기본 fixture D1은 nil로 두거나 별도의 개발 D1만 사용
- 성공 확인: 원격 migrations/seed가 성공하고 `wrangler deploy --env production`이 Worker
  URL을 반환
- 실패 확인: `wrangler whoami`, token scope, account 선택, D1 name/UUID, environment
  binding을 확인한다.

## 3. 선택 사항: Backfill 관리자 secret

- 수행 위치: 로컬 비밀관리 도구와 Cloudflare Worker secret
- 필요한 값: 16자 이상 예측 불가능한 `BACKFILL_TOKEN`
- 등록: `pnpm --dir=apps/worker exec wrangler secret put BACKFILL_TOKEN --env production`
- 성공 확인: 올바른 Bearer token의 POST는 202, 없거나 틀린 token은 401
- 실패 확인: production environment에 저장했는지와 Authorization header를 확인한다.

## 4. GitHub Pages와 실제 URL

- 수행 위치: GitHub 저장소 Actions와 Settings → Pages
- 필요한 값: Actions 권한, `github-pages` environment, 선택적 custom domain
- 설정: `.github/workflows/pages.yml`의 Pages-static build/output/env 값을 사용
- 성공 확인: 실제 HTTPS URL에서 `/`, `/method`, `/products`, `/faq`, `/privacy`, `/terms`,
  `/disclaimer`, `/robots.txt`, `/sitemap.xml`, 대표 상품 JSON이 정상이고 fixture 문구가
  없으며 실제 기준일이 표시됨
- 실패 확인: Secret 이름, Node 24, pnpm lockfile, 생성 step, build root/output, Pages base
  path를 확인한다. `_headers` 파일이 GitHub Pages 응답에 적용된다고 가정하지 않는다.

## 5. 운영 smoke와 최신 데이터 확인

- 수행 위치: 실제 GitHub Pages URL과 Actions run; Worker를 선택한 경우 Worker URL
- 필요한 값: 위 배포 결과
- 성공 확인: 390px/1440px 계산 흐름, API health, 실제 최신 기준일, console error 0,
  금융 입력 네트워크 유출 0
- 실패 확인: Pages 생성/build/deploy log와 정적 JSON의 stale metadata를 먼저 확인한다.
  Worker를 선택한 경우에만 D1 `sync_runs`와 CORS allowlist도 확인한다. stale/degraded를
  임의로 green 처리하지 않는다.

## 6. AdSense와 consent (선택)

- 수행 위치: Google AdSense 및 운영 consent 관리 화면
- 필요한 값: 승인된 client ID, result/content slot ID, 실제 consent 준비 상태
- 설정: 세 광고 ID와 `PUBLIC_CONSENT_READY=true`를 Pages 운영 환경에 함께 등록
- 성공 확인: 동의 후 두 수동 슬롯만 로드되고 계산 버튼/결과와 겹치지 않음
- 실패 확인: 하나라도 불완전하면 `PUBLIC_CONSENT_READY=false`로 되돌려 외부 광고 요청을
  완전히 비활성화한다.

GitHub service key Secret은 등록됐다. 실제 18개 응답과 Pages 배포는 workflow 실행으로
확인해야 한다. D1/Cloudflare는 선택되지 않았고 AdSense 승인은 제공되지 않았다.
