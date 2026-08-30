# 양복음복 Release Report

## Milestones

- P0: Complete — pnpm/Node workspace, strict TypeScript, fixture mode, commands, CI, and documents.
- P1: Complete — Astryx-based bright responsive calculator-first UI and visual baselines; the earlier
  game/pixel direction is retired.
- P2: Complete — pure calculation engine, date/format policy, golden/property tests, and greater than
  95% coverage.
- P3: Complete — search, one-to-fifty rows, local errors, live totals, draft/apply current price,
  opt-in 30-day local persistence, protected product changes, and confirmed reset.
- P4: Complete — actual P/L, product and 1/5/20-day underlying break-even, compound/theory comparison,
  official/manual/stale/partial/error states, concise adaptive results, and focus recovery.
- P5: Complete — FSC adapters, strict range/schema validation, sanitized fixtures, evidence-conservative
  18-product master, and malformed/empty preservation semantics.
- P6: Complete — Worker API, D1, fixture/live ingestion, schedule, backfill, exact CORS, retry/timeout,
  fail-closed per-product health, partial-failure reporting, and Workerd+D1 test.
- P7: Complete — original content, method/products/FAQ/policies, SEO, sitemap, robots, 404, preview
  noindex, disabled-by-default advertising, and data-error contact path.
- P8: Complete — full local verification, responsive/visual/privacy/accessibility QA, console, bundle,
  dependency, secret, security-header, dead-code, and copy review.
- P9: Pages-static release candidate complete — official-data export, 15:40 KST scheduling, release
  gate, deployment/rollback instructions, and this evidence report. Live Actions/Pages witnessing
  and AdSense remain external.

## Implemented

양복음복 is a responsive Korean calculator for domestic leveraged and inverse ETF/ETN positions.
Users can select a verified product, enter current purchase lots, inspect immediate weighted totals,
apply an official or manual current price, and calculate actual P/L, product break-even,
equal-daily-move 1/5/20-day underlying break-even, simple leverage, daily compounding, compound
effect, and theory-versus-product performance.

The completion audit simplified the experience to one primary task flow. It removed developer copy,
inactive ad placeholders, game/pixel remnants, misleading empty zeroes, a single-row delete control,
prominent destructive reset, and repeated unavailable output. Actual-only products now present one
scope warning and only usable metrics. Mobile supported products are grouped by underlying asset.

## Architecture

- `apps/web`: Astro static content plus one React calculator island using Astryx 0.5.0 neutral theme.
- `packages/calculation-core`: UI-independent domain types, validation, calculation, and formatting.
- `packages/contracts`: Zod API/provider schemas, product master, fixtures, and FSC normalization.
- `scripts/generate-pages-data.ts`: Secret-scoped, atomic, fail-closed 18-product static export.
- `apps/worker`: Cloudflare Worker routes, D1 repository, fixture/live ingestion, schedule, backfill,
  CORS, caching/freshness, security headers, and safe errors as an optional dynamic path.
- `tests/e2e`: production-static flow, privacy, accessibility, responsive, and visual gates.

Financial position values stay in React state and, only after explicit opt-in, validated localStorage.
The browser sends public product/date identifiers only. Worker credentials and D1 stay server-side.

## Calculation verification

- Golden/property/core tests: 30/30 PASS.
- Contracts/provider tests: 29/29 PASS.
- Repository unit/contract/web/Worker tests: 87/87 PASS.
- Core coverage: 99.34% statements, 97.87% branches, 100% functions, 100% lines.
- Missing intermediate underlying trading dates exclude affected lots and produce a partial/unavailable
  warning instead of a false full analysis.

## Browser verification

- Mobile: PASS at 360×800, 390×844, and 430×932 with no horizontal page overflow.
- Tablet/desktop: PASS at 768×1024, 1280×900, and 1440×1000.
- E2E: 18/18 non-visual scenarios PASS against a fresh production-static build.
- Accessibility: 3/3 PASS; axe runs without severity filtering and reports 0 violations.
- Visual regression: 20/20 current fixture comparisons PASS; the live-only API-error case is the one
  intentional fixture-mode skip.
- Console: current-run captured application warnings/errors 0.
- Browser tooling: native Codex Browser failed because its trusted bridge was unavailable; Playwright
  Chromium was used as the disclosed rendered fallback.

## Data

- Fixture mode: deterministic, sanitized, offline, visibly labeled, and noindexed.
- Live adapter: implemented for the documented FSC operations with query construction, response
  normalization, encoding handling, bounded retry/timeout, schema/range validation, and preservation
  on malformed/empty response.
- Product master: 18 active, evidence-backed ETF/ETNs, conservatively `actual-only` until exact live
  underlying series are witnessed.
- Worker/D1: migration, seed, sync, idempotent upsert, per-product health coverage, last-sync status,
  products/analysis APIs, and partial-failure signaling are implemented and locally tested.
- The approved key is registered as `DATA_GO_KR_SERVICE_KEY` in GitHub Actions Secrets; the value was
  not read. The first real payload and latest `basDt` still require the release workflow run.

## Privacy and security

- Financial input values never leave the browser and are absent from request URL/body/beacon/ad
  traffic in automated tests.
- Persistence is off by default, opt-in only, schema-validated, and expires after 30 days.
- Query/body schemas reject unknown or forbidden inputs; SQL is parameter-bound; backfill requires a
  bodyless authenticated POST; CORS is exact-origin; upstream errors are sanitized.
- Ingestion no longer reports partial or empty provider work as successful. Health fails closed on
  missing per-product coverage or failed last sync.
- `.env`/`.dev.vars` secrets are not tracked. Production artifacts are scanned for fixture and
  server-secret leakage.
- Static assets carry a baseline `_headers` policy file, but GitHub Pages is not assumed to apply it;
  Worker JSON includes CSP/nosniff. Actual hosted headers remain a deployment smoke check.
- Advertising is absent unless live mode, all IDs, and explicit consent readiness are present.
- `pnpm audit --audit-level high`: no known vulnerabilities.

## Commands

- `pnpm verify:quick`: PASS.
- `pnpm verify`: PASS.
- `pnpm astryx doctor`: 6 passed, 0 warnings, 0 failures.
- `pnpm audit --audit-level high`: PASS, no known vulnerabilities.
- Pages-static `pnpm release:check`: environment, workflow, build, security, privacy, SEO, and ad gates
  PASS; without Secret-generated JSON it fails closed exactly on the missing data directory.

## Deployment

- Current release candidate: locally verified and awaiting PR/CI/merge.
- Existing public URL: `https://swk0218.github.io/LeverageCaculator/` is a prior fixture preview and
  does not prove the current local revision.
- Target live structure: GitHub source → Actions official-data export → GitHub Pages static site.
- Live Worker/API/D1 URL: none; this is an optional future expansion and not a Pages blocker.

## External actions remaining

1. Open and merge a CI-green PR.
2. Witness 18 real product exports, a positive Pages-static release check, and Pages deployment.
3. Verify representative JSON `basDt`, freshness, console, privacy boundary, and 390px/1440px UI.
4. Enable AdSense only after approval and consent readiness; otherwise keep it disabled.

Exact locations, values, commands, and success/failure checks are in `docs/EXTERNAL_ACTIONS.md` and
`docs/DEPLOY.md`.

## Known limitations

- Live FSC payload, quota, freshness, and exact underlying series await the first Actions run.
- Production products intentionally remain actual-only until live series evidence exists.
- D1 failure is now surfaced as partial, but atomicity is not guaranteed across all bounded batches
  in one ingestion run.
- Final origin-specific CSP/AdSense behavior and hosted `_headers` must be witnessed after deployment.
- No current-revision Pages deployment, live latest-date check, or ad activation was yet witnessed.

## Important files

- `apps/web/src/features/calculator/CalculatorApp.tsx`
- `apps/web/src/features/calculator/components/PersistenceControl.tsx`
- `apps/web/src/features/calculator/calculator.css`
- `packages/calculation-core/src/calculations.ts`
- `packages/contracts/src/fsc.ts`
- `packages/contracts/src/schemas.ts`
- `packages/contracts/src/product-master.ts`
- `apps/worker/src/app.ts`
- `apps/worker/src/ingestion.ts`
- `apps/worker/src/repository.ts`
- `scripts/release-check.mjs`
- `docs/QA.md`
- `docs/EXTERNAL_ACTIONS.md`

## Screenshot paths

- Desktop task: `C:/Users/swk02/.codex/visualizations/2026/08/25/01a03b23-4840-7f33-a871-72cdbf582414/yangbok-completion-audit-20260826/18-final-desktop-task.png`
- Desktop result: `C:/Users/swk02/.codex/visualizations/2026/08/25/01a03b23-4840-7f33-a871-72cdbf582414/yangbok-completion-audit-20260826/19-final-desktop-result.png`
- Mobile validation: `C:/Users/swk02/.codex/visualizations/2026/08/25/01a03b23-4840-7f33-a871-72cdbf582414/yangbok-completion-audit-20260826/21-final-mobile-validation.png`
- Mobile full result: `C:/Users/swk02/.codex/visualizations/2026/08/25/01a03b23-4840-7f33-a871-72cdbf582414/yangbok-completion-audit-20260826/22-final-mobile-result.png`
- Mobile actual-only: `C:/Users/swk02/.codex/visualizations/2026/08/25/01a03b23-4840-7f33-a871-72cdbf582414/yangbok-completion-audit-20260826/23-final-mobile-actual-only.png`
- Mobile products: `C:/Users/swk02/.codex/visualizations/2026/08/25/01a03b23-4840-7f33-a871-72cdbf582414/yangbok-completion-audit-20260826/24-final-mobile-products.png`
- Approved regression set: `tests/e2e/visual.spec.ts-snapshots/`
