# 실제 종목 데이터 연결

## 결론

네. 이 서비스의 운영 데이터 흐름에는 공공데이터포털 **서비스키**가 필요합니다.
다만 키를 웹 브라우저나 `PUBLIC_*` 환경변수에 넣으면 안 됩니다. 브라우저는
배포된 Worker만 호출하고, Worker의 비공개 secret이 금융위원회 API를 호출하도록
구성되어 있습니다.

## 1. 서비스키 발급

공공데이터포털에 로그인한 뒤 각 페이지에서 **활용신청**을 누릅니다. 모두 무료이고
개발·운영 신청은 자동승인으로 안내되어 있습니다.

- [금융위원회 주식시세정보 — 서비스키 발급](https://www.data.go.kr/data/15094808/openapi.do)
- [금융위원회 증권상품시세정보 — ETF/ETN](https://www.data.go.kr/data/15094806/openapi.do)
- [금융위원회 지수시세정보 — 기초지수](https://www.data.go.kr/data/15094807/openapi.do)

이 프로젝트가 실제로 사용하는 세 API입니다. 발급된 키는 인코딩/디코딩 형태를
그대로 입력할 수 있고 Worker adapter가 정규화합니다.

참고로 이 데이터는 실시간 시세가 아닙니다. 공식 페이지 기준으로 하루 한 번
갱신되며 기준일 다음 영업일 오후 1시 이후 제공됩니다. 따라서 앱의 “공식 데이터”는
마지막 거래일 종가와 기준일을 함께 표시합니다.

## 2. 로컬에서 실제 응답 확인

저장소 루트의 `.env`에는 다음 공개 연결값만 둡니다.

```powershell
PUBLIC_DATA_MODE=live
PUBLIC_API_BASE_URL=http://127.0.0.1:8787
PUBLIC_SITE_URL=http://localhost:4321
```

별도 터미널에서 `apps/worker/.dev.vars`를 만들고 키를 Worker secret처럼 둡니다.
이 파일은 `.gitignore`에 포함되어 있어 커밋되지 않습니다.

```text
DATA_MODE=live
PUBLIC_SITE_URL=http://localhost:4321
ALLOWED_ORIGINS=http://localhost:4321,http://127.0.0.1:4321
DATA_GO_KR_SERVICE_KEY=여기에_발급받은_서비스키
BACKFILL_TOKEN=16자_이상의_새_랜덤토큰
```

그 다음 로컬 D1과 Worker를 시작합니다.

```powershell
pnpm db:migrate:local
pnpm data:seed
pnpm dev
```

Worker가 실행된 뒤 다른 터미널에서 최근 데이터를 요청합니다.

```powershell
pnpm data:sync:local
Invoke-RestMethod http://127.0.0.1:8787/api/v1/health
Invoke-RestMethod http://127.0.0.1:8787/api/v1/products
```

웹을 새로고침하면 `[체험용]` 대신 실제 상품과 기준일이 표시되고,
`/api/v1/analysis-data?productCode=...&from=...` 응답이 계산기에 사용됩니다.

## 3. Cloudflare 운영 secret 등록

운영 Worker를 배포할 때는 로컬 파일이나 저장소가 아니라 Wrangler secret으로
등록합니다.

```powershell
pnpm --dir=apps/worker exec wrangler secret put DATA_GO_KR_SERVICE_KEY --env production
pnpm --dir=apps/worker exec wrangler secret put BACKFILL_TOKEN --env production
```

이후 운영 Pages 빌드에는 다음 공개 연결값만 설정합니다.

```text
PUBLIC_DATA_MODE=live
PUBLIC_SITE_URL=https://최종-사이트-주소
PUBLIC_API_BASE_URL=https://배포된-worker-주소
```

키만으로 운영 연결이 완성되는 것은 아닙니다. Cloudflare 계정 인증, 운영 D1 UUID,
Worker 배포, 최초 backfill, CORS origin 설정까지 완료해야 실제 데이터가 계산기에
도달합니다. 전체 순서는 [배포 절차](./DEPLOY.md)를 따릅니다.

## 키 오류가 날 때

- `SERVICE_KEY_IS_NOT_REGISTERED_ERROR`: 해당 API 활용신청이 끝났는지와 키 값을 확인합니다.
- `PERMISSION_DENIED`: 주식·증권상품·지수 API를 각각 활용신청했는지 확인합니다.
- `degraded` health: Worker는 살아 있지만 아직 D1에 최신 가격이 없을 수 있으므로
  최초 backfill 또는 scheduled sync 후 다시 확인합니다.

서비스키는 절대 GitHub Pages 번들, `PUBLIC_*`, 브라우저 네트워크 요청, 커밋 파일에
넣지 않습니다.
