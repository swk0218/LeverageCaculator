# Deployment

양복음복은 `apps/web/dist`의 정적 Astro 사이트와 `apps/worker`의 Worker API + D1로
배포한다. 휴대폰에서 즉시 확인할 수 있도록 GitHub Pages fixture 체험판을 먼저
공개하고, 실제 공공데이터 운영 배포는 Cloudflare 경로로 분리한다.

Cloudflare의 현재 공식 절차는 [Pages Git 연동](https://developers.cloudflare.com/pages/configuration/git-integration/),
[D1 Wrangler 명령](https://developers.cloudflare.com/d1/wrangler-commands/),
[Worker secret](https://developers.cloudflare.com/workers/configuration/secrets/) 문서를 함께 참고한다.

## 0. GitHub Pages 체험판 (휴대폰에서 바로 사용)

`main`에 push하면 [`.github/workflows/pages.yml`](../.github/workflows/pages.yml)이
Astro 정적 사이트를 `PUBLIC_DATA_MODE=fixture`로 빌드해 GitHub Pages에 배포한다.

- 공개 URL: <https://swk0218.github.io/LeverageCaculator/>
- Pages base path: `/LeverageCaculator`
- 사이트 origin: `https://swk0218.github.io`
- 출력 디렉터리: `apps/web/dist`
- fixture 상품만 사용하며 화면에는 개발·미리보기 모드가 명시된다.
- fixture 모드는 `noindex,nofollow`와 `robots.txt Disallow: /`를 유지한다.

이 경로는 계산기 UI와 정제된 예시 데이터로 제품 흐름을 확인하는 공개 데모다.
실시간 금융위원회 데이터, Worker API, D1, backfill을 연결한 운영 릴리스로 간주하지
않는다. workflow의 `configure-pages`가 Pages를 자동 활성화한다. 저장소 정책상 자동
활성화가 거부되면 저장소 **Settings → Pages → Source: GitHub Actions**를 한 번 선택한
뒤 workflow를 다시 실행한다.

## 1. 로컬 릴리스 확인

저장소 루트의 PowerShell에서 실행한다.

```powershell
corepack enable
pnpm install --frozen-lockfile
pnpm verify
pnpm audit --audit-level high
```

fixture 모드는 로컬 QA 전용이다. 운영 빌드에는 아래 값을 실제 HTTPS 주소로 넣는다.

```powershell
$env:PUBLIC_DATA_MODE = 'live'
$env:PUBLIC_SITE_URL = 'https://YOUR_SITE.example'
$env:PUBLIC_API_BASE_URL = 'https://YOUR_WORKER.workers.dev'
```

## 2. Cloudflare 로그인과 D1 생성

Cloudflare 계정의 Workers & Pages 사용 권한으로 로그인한다.

```powershell
pnpm --dir=apps/worker exec wrangler login
pnpm --dir=apps/worker exec wrangler whoami
pnpm --dir=apps/worker exec wrangler d1 create yangbok-eumbok --location=apac
```

마지막 명령이 돌려준 UUID를 `apps/worker/wrangler.jsonc`의 `env.production` D1
`database_id`에만 넣는다. 기본 fixture 환경의 nil ID는 원격 배포를 막는 안전장치다.
기본 환경도 원격 배포해야 한다면 운영 D1과 다른 개발용 D1을 따로 만든다. 운영 사이트
주소로 `PUBLIC_SITE_URL`과 `ALLOWED_ORIGINS`도 바꾼다. 두 값은 경로 없는 동일한 HTTPS
origin이어야 하며 wildcard CORS는 사용하지 않는다.

CI에서 토큰을 쓰는 경우 로컬 로그인 대신 최소 권한 `CLOUDFLARE_API_TOKEN`과
`CLOUDFLARE_ACCOUNT_ID`를 CI secret으로 둔다. 실제 토큰은 저장소 파일에 쓰지 않는다.

## 3. 공공데이터 키와 Worker secret

공공데이터포털에서 아래 금융위원회 API 세 건을 활용 신청한다.

- [주식시세정보](https://www.data.go.kr/data/15094808/openapi.do)
- [증권상품시세정보](https://www.data.go.kr/data/15094806/openapi.do)
- [시장지수시세정보](https://www.data.go.kr/data/15094807/openapi.do)

포털이 발급한 인코딩 또는 디코딩 키를 그대로 입력해도 adapter가 정규화한다.
`BACKFILL_TOKEN`은 16자 이상의 새 난수로 만든다.

```powershell
pnpm --dir=apps/worker exec wrangler secret put DATA_GO_KR_SERVICE_KEY --env production
pnpm --dir=apps/worker exec wrangler secret put BACKFILL_TOKEN --env production
```

`env.production.secrets.required`가 두 secret을 선언하므로 누락된 운영 배포는
fail-closed로 중단된다.

## 4. 원격 D1 준비와 Worker 배포

```powershell
pnpm --dir=apps/worker exec wrangler d1 migrations list yangbok-eumbok --remote --env production
pnpm --dir=apps/worker exec wrangler d1 migrations apply yangbok-eumbok --remote --env production
pnpm --dir=apps/worker exec wrangler d1 execute yangbok-eumbok --remote --env production --file=./seed.sql
pnpm --dir=apps/worker exec wrangler deploy --env production
```

Worker URL을 받은 뒤 다음 응답을 확인한다.

```powershell
$api = 'https://YOUR_WORKER.workers.dev'
Invoke-RestMethod "$api/api/v1/health"
Invoke-RestMethod "$api/api/v1/products"
```

성공 기준은 HTTP 200, `mode: live`, `database: ok`이다. 첫 수집 전 health의
`status`가 `degraded`일 수 있으며, 이는 최신 가격이 아직 없다는 뜻이지 성공으로
숨기지 않는다.

## 5. 최초 backfill과 정기 수집

Worker 배포 후 body 없는 인증 POST로 최초 구간을 채운다.

```powershell
$api = 'https://YOUR_WORKER.workers.dev'
$headers = @{ Authorization = "Bearer $env:BACKFILL_TOKEN" }
Invoke-RestMethod -Method Post -Headers $headers -Uri "$api/api/v1/admin/backfill?from=2026-05-27&to=$(Get-Date -Format yyyy-MM-dd)"
```

HTTP 202를 확인한 뒤 `/api/v1/health`와 대표 상품의
`/api/v1/analysis-data?productCode=0198B0&from=2026-05-27`를 확인한다. 평일
05:30 UTC(14:30 KST) scheduled handler는 최근 10일을 다시 요청하며 D1의
`(asset_id, trade_date)` unique key로 중복 없이 upsert한다. 빈 응답이나 실패는
기존 정상 데이터를 삭제하지 않는다.

## 6. Pages 연결

권장 경로는 Cloudflare Dashboard의 **Workers & Pages → Create → Pages → Connect to Git**에서
GitHub 저장소 `swk0218/LeverageCaculator`를 연결하는 것이다.

- Production branch: `main`
- Root directory: 저장소 루트
- Build command: `corepack enable && pnpm install --frozen-lockfile && pnpm --filter @yangbok/web build`
- Build output directory: `apps/web/dist`
- Node version: `.nvmrc`의 24
- `PUBLIC_DATA_MODE`: `live`
- `PUBLIC_SITE_URL`: 최종 Pages 또는 커스텀 도메인 HTTPS URL
- `PUBLIC_API_BASE_URL`: 배포된 Worker HTTPS URL
- `PUBLIC_CONSENT_READY`: 광고 승인 전 `false`

Direct Upload를 선택한 경우에는 [공식 Direct Upload 절차](https://developers.cloudflare.com/pages/get-started/direct-upload/)대로 실행한다.

```powershell
pnpm --filter @yangbok/web build
pnpm --dir=apps/worker exec wrangler pages project create
pnpm --dir=apps/worker exec wrangler pages deploy ../web/dist --project-name=yangbok-eumbok
```

두 배포 방식을 한 Pages 프로젝트에서 임의로 섞지 말고, Git 자동 배포가 필요하면
처음부터 Git 연동을 선택한다.

## 7. 운영 release check와 smoke test

실제 값이 준비된 동일한 셸에서 실행한다.

```powershell
$env:DATA_GO_KR_SERVICE_KEY = 'SET_IN_THIS_PROCESS_ONLY'
$env:BACKFILL_TOKEN = 'SET_IN_THIS_PROCESS_ONLY'
$env:D1_DATABASE_ID = 'REAL_D1_UUID'
$env:CLOUDFLARE_API_TOKEN = 'SET_IN_THIS_PROCESS_ONLY'
pnpm release:check
```

예시 문자열은 실제로 입력하는 값이 아니다. release check는 placeholder, 낮은 다양성의
토큰, canonical origin이 아닌 URL, 운영 D1과 fixture D1의 공유를 거부한다. 로컬 artifact
검사가 모두 통과해도 외부 값이 하나라도 없으면 종료 코드 2, fixture가 명시적으로
활성화되어 있으면 종료 코드 1이며, 실제 운영 값이 모두 검증된 경우에만 0을 반환한다.

그 다음 실제 사이트를 모바일과 데스크톱에서 열어 상품 검색, 한 건/세 건 매수,
현재가 수정, 손실·수익·인버스, 새로고침 복원, 초기화를 확인한다. DevTools Network에서
매수일·매수가·수량·평단·손익·직접 입력 현재가가 요청 URL/body에 없는지도 확인한다.

## 8. 커스텀 도메인과 광고

Pages와 Worker의 Custom domains에서 DNS를 연결한 뒤 두 URL을 다시 환경변수와
CORS allowlist에 반영하고 재배포한다. canonical, sitemap, robots 및 API CORS를
실제 도메인에서 확인한다.

`apps/web/public/_headers`에는 정적 Pages 응답용 nosniff, referrer, frame, browser-feature
보호가 기본 설정되어 있다. Cloudflare의 공식
[Pages custom headers 문서](https://developers.cloudflare.com/pages/configuration/headers/)에
따라 배포 응답에서 이를 확인한다. CSP는 최종 site/API origin과 선택적 AdSense origin이
확정된 뒤 추가한다. `default-src`, `base-uri`, `object-src`, `frame-ancestors`,
`form-action`을 제한하고, `connect-src`에는 실제 Worker URL만, 광고 origin은 승인과 동의가
확인된 경우에만 허용한다.

AdSense 승인과 consent 구현이 모두 끝난 경우에만 네 광고 환경변수를 한 번에 설정한다.

```text
PUBLIC_ADSENSE_CLIENT=ca-pub-...
PUBLIC_AD_SLOT_RESULT=...
PUBLIC_AD_SLOT_CONTENT=...
PUBLIC_CONSENT_READY=true
```

하나라도 없으면 외부 광고 script와 initializer는 로드되지 않는다.

## 9. Rollback

- Worker: `pnpm --dir=apps/worker exec wrangler rollback --env production` 또는 Cloudflare
  Dashboard의 Worker → Deployments에서 직전 정상 version을 선택한다. 공식
  [Worker rollback 안내](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/)처럼
  D1 binding 자체는 rollback되지 않으므로 schema 호환성을 먼저 확인한다.
- Pages: 직전 정상 Git commit을 다시 배포하거나 revert commit을 `main`에 반영한다.
- D1: migration은 앞으로 수정하는 새 migration을 만든다. 데이터 복구가 필요하면 D1
  Time Travel/backup을 사용하며, 애플리케이션 rollback과 별도로 검증한다.

## Launch checklist

- [x] GitHub Pages fixture 체험판 workflow와 공개 URL
- [x] GitHub Actions `CI` 성공 (run #2, commit `acb29e0`)
- [x] `pnpm verify` 성공 (로컬 및 Ubuntu CI)
- [ ] 운영 값으로 `pnpm release:check` 성공
- [ ] D1 migration/seed/backfill 성공
- [ ] Worker health/products/analysis-data HTTP 200
- [ ] 최신 기준일과 stale 상태가 실제 데이터와 일치
- [ ] 운영 Cloudflare Pages canonical/robots/sitemap 정상
- [ ] Pages 보안 헤더 정상, 최종 origin 기준 CSP 적용·검증
- [ ] 390px 및 1440px 실제 URL 화면 확인
- [ ] 브라우저 console error 0
- [ ] 금융 입력 네트워크 유출 0
- [ ] 광고/consent gate 확인
- [ ] rollback 대상 Worker version과 Git commit 기록
