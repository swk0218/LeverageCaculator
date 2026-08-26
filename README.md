# 양복음복

국내 상장 레버리지·인버스 ETF/ETN의 실제 손익, 본전 조건, 일일 복리효과를
계산하는 개인정보 보호 중심 반응형 웹 도구다. 회원가입과 계좌 연동 없이 매수일,
매수가, 수량만 입력하며 금융 입력은 브라우저 밖으로 보내지 않는다.

현재 상태는 **로컬 검증을 마친 프로덕션 릴리스 후보**다. 휴대폰에서 바로 확인할 수
있는 [GitHub Pages 체험판](https://swk0218.github.io/LeverageCaculator/)도 fixture
모드로 공개되어 있다. fixture 모드에서는 외부 계정 없이 전체 흐름이 동작한다. 실제
공공데이터와 Cloudflare 배포는 service key, D1 UUID 및 Cloudflare 인증이 필요하며
별도의 운영 릴리스로 분리한다.

## What is included

- Meta의 오픈소스 [Astryx](https://github.com/facebook/astryx) 0.5.0 neutral theme 기반 UI
- Astro 정적 페이지 + React calculator island + strict TypeScript
- 1~50개 매수분, 실시간 평단/총수량/총매수금액, 공식/직접 입력 현재가
- 실제 손익, 상품 본전율, 1·5·20일 기초자산 본전 조건
- 매수분별 단순 배수와 일일 복리, 복리효과, 공식 상품 실제 성과 비교
- +2X, -2X, stale, 부분 분석, malformed/empty/error fixture
- 금융위원회 공공데이터 adapter, runtime schema, 검증 보수적인 18개 production product master
- Cloudflare Worker API, scheduled ingestion, D1 migration/seed/upsert/backfill
- 정책·방법·상품·FAQ·SEO·404·preview noindex·consent 기반 광고 gate
- Vitest, fast-check, Workerd+D1, Playwright, axe, 개인정보·반응형·시각 회귀 테스트

## Requirements

- Node.js 24 (`.nvmrc`)
- pnpm 11.19 (`packageManager` 고정)

## Local development

```powershell
corepack enable
pnpm install --frozen-lockfile
Copy-Item .env.example .env
pnpm db:migrate:local
pnpm data:seed
pnpm dev
```

- Web: `http://127.0.0.1:4321`
- Worker: `http://127.0.0.1:8787`
- `PUBLIC_DATA_MODE=fixture`가 기본이며 외부 네트워크나 키가 필요 없다.
- 웹만 실행: `pnpm dev:web`
- Worker만 실행: `pnpm dev:worker`
- Worker 실행 중 fixture scheduled sync: `pnpm data:sync:local`

실제 `.env`와 `.dev.vars`는 Git에서 제외된다. 예시 값만 `.env.example`에 있다.

## Phone preview

- [GitHub Pages에서 바로 열기](https://swk0218.github.io/LeverageCaculator/)
- 공개 페이지는 외부 API 키가 필요 없는 `fixture` 체험 모드다.
- 화면에 표시되는 `[체험용]` 상품은 계산 흐름과 복리 효과를 확인하기 위한
  정제된 예시 데이터이며, 실시간 시세나 투자 권유가 아니다.
- 실제 금융위원회 데이터와 Worker/D1 운영 배포는 [배포 절차](docs/DEPLOY.md)의
  Cloudflare 경로를 별도로 완료해야 한다.

## Commands

| Command                         | Purpose                                                         |
| ------------------------------- | --------------------------------------------------------------- |
| `pnpm build`                    | Web production build와 Worker dry-run bundle                    |
| `pnpm lint` / `pnpm typecheck`  | 정적 검증                                                       |
| `pnpm format:check`             | Prettier gate                                                   |
| `pnpm test`                     | 전체 unit/contract/Worker/web unit                              |
| `pnpm test:core`                | 순수 계산 엔진 golden/property tests                            |
| `pnpm test:contracts`           | API/fixture/live adapter contract tests                         |
| `pnpm test:integration`         | Cloudflare 공식 Workerd + D1 runtime integration                |
| `pnpm test:e2e`                 | 비시각 Playwright 흐름·반응형·개인정보 테스트                   |
| `pnpm test:a11y`                | axe 및 키보드 접근성                                            |
| `pnpm test:visual`              | 승인된 production-static 이미지 비교                            |
| `pnpm verify:quick`             | format → lint → type → core → contracts                         |
| `pnpm verify`                   | 전체 오프라인 fixture 릴리스 검증                               |
| `pnpm release:check`            | live-mode bundle·secret·fixture·SEO·광고·migration release gate |
| `pnpm audit --audit-level high` | 현재 dependency advisory 검사                                   |

## Architecture

```text
apps/web                 Astro pages + React calculator island
apps/worker              Cloudflare Worker + D1 + scheduled ingestion
packages/calculation-core Pure calculation and formatting
packages/contracts       Runtime contracts, FSC adapter, product master, fixtures
tests/e2e                Flow, a11y, privacy, responsive, visual regression
docs                     Product, formula, data, QA, deployment, release evidence
```

핵심 계산은 UI와 분리된 순수 함수다. 브라우저가 Worker에 보내는 값은 공개 상품코드와
조회 시작일뿐이며, 매수일·가격·수량·평단·손익·직접 입력 현재가는 localStorage와
메모리 안에서만 처리된다.

## Data modes

- `fixture`: 외부 키 없는 개발/테스트 전용. 화면에 명시하고 `noindex,nofollow` 처리한다.
- `live`: 브라우저는 Worker API만 호출한다. Worker가 암호화된
  `DATA_GO_KR_SERVICE_KEY`로 공식 API를 수집해 D1에 보관한다.

production product master는 발행사/KRX 근거가 있는 18개 상품을 포함하지만, service
key로 정확한 기초지수 시계열을 실제 대조하기 전까지 모두 `actual-only`다. 이 경우
실제 손익과 상품 본전 조건은 제공하고, 복리 분석은 근거 없이 만들어내지 않는다.

## Documentation

- [계산 명세](docs/CALCULATION.md)
- [공식 데이터와 product master](docs/DATA.md)
- [설계 결정](docs/DECISIONS.md)
- [QA 증거](docs/QA.md)
- [배포 절차](docs/DEPLOY.md)
- [외부 연결 작업](docs/EXTERNAL_ACTIONS.md)
- [최종 릴리스 보고서](docs/RELEASE_REPORT.md)

이 서비스는 과거 가격 데이터 기반 계산 도구이며 투자 권유나 수익 예측을 제공하지 않는다.
