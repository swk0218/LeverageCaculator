# Current Status

- Current milestone: P9 complete — deployment-ready, external credentials pending
- Last completed milestone: P9
- Quick verification command: `pnpm verify:quick`
- Full verification command: `pnpm verify`

## Completed

- P0–P9 implementation is complete: Astro/React web app, pure calculation engine, contracts,
  official-data adapter, Cloudflare Worker, D1, scheduled ingestion, content, policy pages, SEO,
  advertising gates, tests, CI, and deployment instructions.
- Meta Astryx 0.5.0 neutral theme is wired as the UI foundation. `pnpm astryx doctor` reports six
  passes, zero warnings, and zero failures; the Button contract resolves from the official package.
- The fixture release candidate passes formatting, lint, strict type checks, 54 unit/contract/web/
  Worker tests (including 17 contract/provider cases), Workerd+D1 integration, production build,
  13 non-visual E2E tests, two accessibility
  tests, and 20 fixture visual comparisons. The separately enabled live API-error visual also passes.
- Calculation core coverage is 99.31% statements, 98.23% branches, 100% functions, and 100% lines.
- The production release gate passes its local artifact checks without fixture products, server
  secrets, production `noindex`, consent bypass, placeholder products, shared fixture/production D1,
  unreviewed TODO/FIXME markers, or missing policy/migration artifacts. It then exits 2 because ten
  credential/configuration prerequisites remain external; an explicitly active fixture mode exits 1.
- Browser privacy checks confirm that purchase dates, prices, quantities, averages, P/L, returns,
  and manually entered prices are not sent in URL, request body, beacon, analytics, or ad traffic.
- Approved Win32 Chromium baselines cover all six required viewports and every required UI state.
  The 20 fixture-mode Linux baselines emitted by GitHub Actions run #1 were reviewed and added;
  the separate opt-in API-error baseline remains Win32-only because CI intentionally runs fixture mode.

## In progress

- None. No code or local validation work remains for the release candidate.

## Blocked only by external credentials

- Set the production `PUBLIC_DATA_MODE=live`, final `PUBLIC_SITE_URL`, and final
  `PUBLIC_API_BASE_URL`.
- Obtain an approved `DATA_GO_KR_SERVICE_KEY` and verify live FSC payloads and field mappings.
- Generate a strong `BACKFILL_TOKEN`; create Cloudflare D1, replace the production D1 ID/origins,
  and apply remote migrations. The default fixture binding remains inert or uses a separate dev D1.
- Authenticate Wrangler with a Cloudflare account or least-privilege API token, then deploy Worker
  and Pages.
- Run the first live backfill and verify the deployed health, products, analysis data, freshness,
  CORS, browser console, privacy boundary, and 390px/1440px rendering.
- Custom domain and AdSense activation are optional; advertising stays fully disabled until both
  approval and consent readiness are explicitly configured.

## Known failures

- None in local gates. Credential-dependent live provider verification and deployment were not
  attempted and are not represented as failures or as completed work.
- Codex's in-app Browser could not initialize because its privileged native pipe bridge was not
  available to the untrusted browser client. Production-static Chromium Playwright was used for all
  rendered interaction, accessibility, privacy, responsive, console, and visual verification.

## Next exact actions

1. Follow `docs/EXTERNAL_ACTIONS.md` sections 1–3 to obtain the public-data key, Cloudflare access,
   D1 UUID, and backfill token.
2. Replace the production placeholders in `apps/worker/wrangler.jsonc`, set the three web
   `PUBLIC_*` variables, then run `pnpm release:check` with the real release environment.
3. Apply remote D1 migrations and seed, deploy the Worker, run the first backfill, and verify
   `/api/v1/health`, `/api/v1/products`, and a representative `/api/v1/analysis-data` response.
4. Connect `swk0218/LeverageCaculator` to Cloudflare Pages and complete the live launch checklist in
   `docs/DEPLOY.md`.

## Latest screenshots

- Astryx reference: `C:/Users/swk02/.codex/visualizations/2026/08/25/01a03b23-4840-7f33-a871-72cdbf582414/astryx-reference-1440.png`
- Desktop initial: `tests/e2e/visual.spec.ts-snapshots/initial-1440-chromium-win32.png`
- Mobile loss result: `tests/e2e/visual.spec.ts-snapshots/loss-result-390-chromium-win32.png`
- Mobile API error: `tests/e2e/visual.spec.ts-snapshots/api-error-390-chromium-win32.png`
- Complete approved set: `tests/e2e/visual.spec.ts-snapshots/`
