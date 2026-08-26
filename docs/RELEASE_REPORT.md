# 양복음복 Release Report

## Milestones

- P0: Complete — pnpm/Node workspace, strict TypeScript, fixture mode, commands, CI, and required
  documentation.
- P1: Complete — Astryx-based responsive calculator-first design, tokens, typography, brand SVG,
  required static/result states, and initial visual baselines.
- P2: Complete — framework-free calculation engine, date/format policy, golden/property tests, and
  greater than 95% core coverage.
- P3: Complete — product search, one-to-fifty purchase rows, validation, live totals, current-price
  override, local restore/reset, and error focus.
- P4: Complete — actual P/L, product and 1/5/20-day underlying break-even, compound effect,
  theoretical/actual gap, comparison bars, official/manual/stale/partial/error states.
- P5: Complete — official FSC adapters and operations, runtime schemas, sanitized fixtures,
  conservative 18-product production master, stale/malformed/empty handling, and contract tests.
- P6: Complete — Cloudflare Worker API, D1 schema/migrations/seed/upserts/sync runs, fixture/live
  ingestion, schedule, authenticated backfill, CORS/cache/retry/timeout, and Workerd+D1 tests.
- P7: Complete — original explanatory content, method/products/FAQ/policy pages, SEO, sitemap,
  robots, JSON-LD, 404, preview noindex, and fail-closed advertising slots.
- P8: Complete — clean frozen install, full local verification, production build, E2E, accessibility,
  privacy, responsive, console, visual, dependency, bundle, secret, TODO/FIXME, and copy review.
- P9: Complete — final README, live-data/D1/Cloudflare/Pages/domain/AdSense/rollback instructions,
  launch checklist, external action list, and this evidence-backed report.

## Implemented

양복음복 is a responsive Korean calculator for domestic leveraged and inverse ETF/ETN holdings.
Users can search verified products, enter one to fifty currently held purchase lots, see immediate
weighted-average/cost/quantity totals, use official or manually supplied current price, and calculate
actual P/L, product break-even, equal-daily-move 1/5/20-day underlying break-even, simple leverage,
daily compounding, compound effect, and the gap between theory and official product performance.

The UI explicitly distinguishes official price dates, manual prices, stale data, actual-only partial
analysis, and API errors. It makes no forecasts or recommendations. Fixture mode supports the entire
flow without an account or network; live production artifacts cannot include fixture products or
fixture banner copy.

## Architecture

- `apps/web`: Astro static pages with one React calculator island and Astryx 0.5.0 neutral theme.
- `packages/calculation-core` (`@yangbok/core`): pure domain types, validation, calculations, and
  formatting with no UI dependency.
- `packages/contracts`: Zod API/provider schemas, verified product master, fixtures, and FSC adapter.
- `apps/worker`: Cloudflare Worker routes, D1 repository, fixture/live ingestion, schedule, backfill,
  CORS, cache/freshness, and safe errors.
- `tests/e2e`: production-static functional, privacy, accessibility, responsive, and visual gates.

The browser requests only public product code and date range. Financial position data stays in React
state and schema-validated localStorage. Worker secrets and D1 access stay server-side.

## Calculation verification

- Golden tests: PASS, including all required +2X/-2X path vectors, multiple purchases, common-date,
  inclusion, and partial-analysis cases.
- Property tests: PASS for break-even reconstruction, aggregation, finite values, inverse signs,
  formatting, and edge behavior.
- Core tests: 27/27 PASS.
- Core coverage: 99.31% statements, 98.23% branches, 100% functions, 100% lines.
- All repository unit/contract/web/Worker tests: 54/54 PASS, including 17/17 contracts.

## Browser verification

- Mobile: PASS at 360×800, 390×844, and 430×932 with zero horizontal overflow and 44px primary
  touch targets.
- Tablet/desktop: PASS at 768×1024, 1280×900, and 1440×1000.
- E2E: 13/13 non-visual scenarios PASS against a fresh production-static build.
- Accessibility: 2/2 PASS; serious/critical axe violations 0; keyboard-only calculation PASS.
- Visual regression: 20/20 fixture comparisons PASS; one separate opt-in live API-error comparison
  PASS; 21 reviewed Win32 Chromium baselines and 20 reviewed Linux Chromium fixture baselines.
- Console: captured application errors 0.
- Browser tooling: native Codex Browser invocation failed at its trusted local bridge; Playwright
  Chromium was used as the production-rendered fallback and this limitation is kept explicit.

## Data

- Fixture mode: Complete, deterministic, sanitized, network-independent, and visibly labeled/
  noindexed.
- Live adapter: Implemented for the three documented Financial Services Commission operations with
  query construction, response normalization, encoding handling, bounded retry/timeout, schema
  validation, and empty/malformed preservation semantics.
- Product master: 18 evidence-backed active production ETF/ETNs, all conservatively `actual-only`
  until the exact underlying series is witnessed with an approved service key. Named +2X/-2X/full,
  stale, mismatch, missing, and actual-only products exist only in test fixtures.
- Local Worker/D1: migration, seed, fixture scheduled sync, idempotent upsert, health, products, and
  analysis-data flow verified; official Workerd+D1 integration 1/1 PASS.
- External API verification: Not performed because `DATA_GO_KR_SERVICE_KEY` was not provided.

## Privacy and security

- Purchase date/price/quantity, average, cost, current value, P/L, return, and manual current price
  never leave the browser and are absent from request URL/body/beacon/ad traffic in automated tests.
- Local storage is versioned and runtime-validated; reset removes the saved position.
- Public API queries are runtime-validated and reject unknown fields; SQL is parameter-bound.
- CORS is exact-origin, upstream errors are sanitized, retries/timeouts are bounded, and backfill is
  Bearer-authenticated without logging the token or financial inputs.
- `.env`/`.dev.vars`, logs, reports, coverage, and local Wrangler state are ignored. Client artifacts
  are scanned for server-only names/values and fixture leakage.
- Advertising is absent unless live mode, a complete ID set, and explicit consent readiness all pass.
- `pnpm audit --audit-level high`: no known vulnerabilities.
- Final CSP origins depend on deployed API/site and optional AdSense approval; the restrictive
  production-header plan is recorded in `docs/QA.md` and the launch checklist.

## Commands

- `pnpm verify:quick`: PASS.
- `pnpm verify`: PASS in offline fixture mode.
- `pnpm release:check`: local artifact gates PASS; fail-closed exit 2 with ten external
  credential/configuration prerequisites. Explicit fixture mode is a local failure with exit 1.
- `pnpm astryx doctor`: 6 passed, 0 warnings, 0 failures.
- `pnpm audit --audit-level high`: PASS, no known vulnerabilities.

## Deployment

- Actual deployed URL: None.
- Status: Deployment-ready release candidate. Deployment was not attempted because no Cloudflare
  account/token, D1 UUID, final URLs, or public-data service key were provided.
- Target: GitHub `swk0218/LeverageCaculator` → Cloudflare Pages static site + Worker API + D1.

## External actions remaining

1. Obtain an approved data.go.kr service key and verify real responses/fields without logging the
   key or full upstream URL.
2. Authenticate Cloudflare, create D1, replace the production database/origin placeholders,
   register `DATA_GO_KR_SERVICE_KEY` and `BACKFILL_TOKEN`, apply migrations/seed, and deploy Worker.
   Keep the default fixture binding inert or point it at a separate development D1.
3. Run the first backfill and verify health/products/analysis-data, latest date, stale/degraded state,
   idempotency, CORS, and safe errors.
4. Connect the GitHub `main` branch to Pages with the documented build/output/environment settings;
   verify real 390px and 1440px flows, console, canonical/robots/sitemap, and network privacy.
5. Optionally connect a custom domain. Enable AdSense only after approval and consent readiness.

Exact UI locations, values, commands, success checks, and failure checks are in
`docs/EXTERNAL_ACTIONS.md`; deployment and rollback are in `docs/DEPLOY.md`.

## Known limitations

- Live FSC payload and freshness were not witnessed without the service key.
- Production products intentionally remain actual-only until each exact underlying series is
  evidenced, preventing accidental double leverage or an invented mapping.
- No actual Cloudflare deployment, URL smoke test, live latest-date check, custom domain, or ad
  activation was performed.
- The native in-app Browser bridge was unavailable; rendered verification used production-static
  Chromium Playwright, with screenshots reviewed separately.

These are external/evidence boundaries, not hidden green claims or local implementation failures.

## Important files

- `README.md`
- `AGENTS.md`
- `packages/calculation-core/src/calculations.ts`
- `packages/contracts/src/fsc.ts`
- `packages/contracts/src/product-master.ts`
- `apps/web/src/features/calculator/CalculatorApp.tsx`
- `apps/worker/src/app.ts`
- `apps/worker/migrations/0001_initial.sql`
- `scripts/release-check.mjs`
- `docs/DATA.md`
- `docs/QA.md`
- `docs/DEPLOY.md`
- `docs/EXTERNAL_ACTIONS.md`

## Screenshot paths

- Astryx reference: `C:/Users/swk02/.codex/visualizations/2026/08/25/01a03b23-4840-7f33-a871-72cdbf582414/astryx-reference-1440.png`
- Desktop implementation: `tests/e2e/visual.spec.ts-snapshots/initial-1440-chromium-win32.png`
- Mobile implementation: `tests/e2e/visual.spec.ts-snapshots/loss-result-390-chromium-win32.png`
- API error: `tests/e2e/visual.spec.ts-snapshots/api-error-390-chromium-win32.png`
- Full approved set: `tests/e2e/visual.spec.ts-snapshots/`
