# External Actions

코드와 로컬 검증으로 대체할 수 없는 작업만 남아 있다. 아래 항목은 실제 계정과
secret을 가진 사용자가 수행해야 하며, 완료 전에는 운영 배포를 완료했다고 표시하지 않는다.

## 1. 공공데이터포털 service key

- 수행 위치: data.go.kr의 금융위원회 주식·증권상품·시장지수 API 활용신청 화면
- 필요한 값: 승인된 `DATA_GO_KR_SERVICE_KEY`
- 등록: `pnpm --dir=apps/worker exec wrangler secret put DATA_GO_KR_SERVICE_KEY --env production`
- 성공 확인: 최초 backfill 후 `/api/v1/health`가 `mode: live`, 대표
  `/api/v1/analysis-data`가 HTTP 200과 실제 거래일을 반환
- 실패 확인: 활용 승인 상태, 키 인코딩 형식, 일일 호출 한도, operation URL, Worker log의
  안전한 오류 code를 확인한다. 키나 upstream 전체 URL을 로그에 복사하지 않는다.

## 2. Cloudflare 계정, API 권한, D1

- 수행 위치: Cloudflare Dashboard 또는 Wrangler
- 필요한 값: 계정, Workers/Pages/D1 권한, D1 UUID, 필요 시 API token/account ID
- 실행: `pnpm --dir=apps/worker exec wrangler d1 create yangbok-eumbok --location=apac`
- 반영: `apps/worker/wrangler.jsonc`의 production D1 ID와 production origin을 실제 값으로
  교체. 기본 fixture D1은 nil로 두거나 별도의 개발 D1만 사용
- 성공 확인: 원격 migrations/seed가 성공하고 `wrangler deploy --env production`이 Worker
  URL을 반환
- 실패 확인: `wrangler whoami`, token scope, account 선택, D1 name/UUID, environment
  binding을 확인한다.

## 3. Backfill 관리자 secret

- 수행 위치: 로컬 비밀관리 도구와 Cloudflare Worker secret
- 필요한 값: 16자 이상 예측 불가능한 `BACKFILL_TOKEN`
- 등록: `pnpm --dir=apps/worker exec wrangler secret put BACKFILL_TOKEN --env production`
- 성공 확인: 올바른 Bearer token의 POST는 202, 없거나 틀린 token은 401
- 실패 확인: production environment에 저장했는지와 Authorization header를 확인한다.

## 4. Pages와 실제 URL

- 수행 위치: Cloudflare Workers & Pages
- 필요한 값: GitHub 저장소 접근 권한, Pages project name, Worker URL, 선택적 custom domain
- 설정: `docs/DEPLOY.md`의 Git 연동 build/output/env 값을 그대로 사용
- 성공 확인: 실제 HTTPS URL에서 `/`, `/method`, `/products`, `/faq`, `/privacy`, `/terms`,
  `/disclaimer`, `/robots.txt`, `/sitemap.xml`이 정상이고 fixture 문구가 없으며, 응답에
  `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`가 존재
- 실패 확인: Node 24, pnpm lockfile, build root/output, 세 `PUBLIC_*` 값을 확인한다.

## 5. 운영 smoke와 최신 데이터 확인

- 수행 위치: 실제 Pages URL과 Worker URL
- 필요한 값: 위 배포 결과
- 성공 확인: 390px/1440px 계산 흐름, API health, 실제 최신 기준일, console error 0,
  금융 입력 네트워크 유출 0
- 실패 확인: Pages build log, Worker deployment log, D1 `sync_runs`, CORS allowlist, stale
  metadata를 순서대로 확인한다. stale/degraded를 임의로 green 처리하지 않는다.

## 6. AdSense와 consent (선택)

- 수행 위치: Google AdSense 및 운영 consent 관리 화면
- 필요한 값: 승인된 client ID, result/content slot ID, 실제 consent 준비 상태
- 설정: 세 광고 ID와 `PUBLIC_CONSENT_READY=true`를 Pages 운영 환경에 함께 등록
- 성공 확인: 동의 후 두 수동 슬롯만 로드되고 계산 버튼/결과와 겹치지 않음
- 실패 확인: 하나라도 불완전하면 `PUBLIC_CONSENT_READY=false`로 되돌려 외부 광고 요청을
  완전히 비활성화한다.

현재 실제 배포 URL, D1 UUID, service key, Cloudflare 인증, AdSense 승인은 제공되지 않았다.
