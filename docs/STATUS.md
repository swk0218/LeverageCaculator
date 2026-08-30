# Current Status

- Current milestone: P9 Pages-static production release — public deployment and live-data smoke complete
- Last completed milestone: official-data static export, 15:40 KST scheduling, and GitHub Pages release
- Quick verification command: `pnpm verify:quick`
- Full verification command: `pnpm verify`

## Completed

- P0–P9 implementation is complete: Astro/React web app, pure calculation engine, contracts,
  official-data adapter, Cloudflare Worker, D1, scheduled ingestion, content, policy pages, SEO,
  advertising gates, tests, CI configuration, and deployment instructions.
- The 2026-08-26 completion audit covered information hierarchy, task flow, accessibility,
  intuitiveness, unnecessary UI, calculation integrity, provider contracts, Worker boundaries,
  privacy, security headers, and release gates.
- The calculator now keeps one clear `상품 선택 → 매수내역 → 계산 → 결과` path. Developer jargon,
  inactive advertisement placeholders, repeated unsupported result cards, initial zero metrics, and
  the game/pixel direction were removed.
- Position persistence is opt-in, scoped to the current device, schema-validated, and expires after
  30 days. Product changes and destructive reset protect users from silent input loss.
- Missing underlying trading dates fail closed for compound analysis. FSC dates outside the requested
  range are rejected. Health and ingestion expose missing/partial data instead of returning false
  success, and bodyless backfill is enforced independently of `Content-Length`.
- Meta Astryx 0.5.0 neutral theme remains the UI foundation. `pnpm astryx doctor` reports six
  passes, zero warnings, and zero failures.
- `pnpm verify` passes: format, lint, strict types, 87 unit/contract/web/Worker tests, one Workerd+D1
  integration test, production build, 18 non-visual E2E tests, three accessibility tests covering all
  axe WCAG violation severities, and 20 fixture visual comparisons. The live-only API-error visual is
  intentionally skipped in fixture verification.
- Calculation core coverage is 99.34% statements, 97.87% branches, 100% functions, and 100% lines.
- `pnpm audit --audit-level high` reports no known vulnerabilities.
- Pages-static `pnpm release:check` passes its environment, workflow, build, security, privacy, SEO,
  and advertising gates. The live Actions run also passed with Secret-generated official JSON.
- Current-run 1440px and 390px rendered task, validation, full-result, partial-result, and product-list
  states were inspected. Browser console warnings/errors were zero.
- PRs #1–#3 were merged after CI. Main CI run `33314666323` passed `pnpm verify`, and Pages run
  `33314666328` generated, validated, uploaded, and deployed the official-data artifact successfully.
- The public site and all 18 product payloads were fetched successfully. The payload set contains
  1,152 official price points, preserves the provider's actual latest `basDt` (`2026-08-27` for this
  run), and contains no service key or upstream URL marker.
- Production Chromium smoke at 390px and 1440px completed product selection, purchase entry, and
  calculation with zero console, page, request, or horizontal-overflow errors.

## Operational follow-up

- The approved `DATA_GO_KR_SERVICE_KEY` remains registered as one repository Actions Secret; its
  value was not read, copied, logged, or included in the public artifact.
- The push-triggered production cycle is witnessed. The first naturally scheduled weekday
  `15:40 KST` cycle remains an operational recurrence check, not a blocker for the working public
  release.

## External or excluded scope

- AdSense remains disabled until approval, complete slot configuration, and consent readiness exist.
- Cloudflare Worker/D1, backfill, CORS, and remote migrations are optional expansion work, not blockers
  for the GitHub Pages-static release.

## Known failures and evidence boundaries

- `pnpm verify` passes with 87 unit/contract/web/Worker tests, one Workerd+D1 integration test, 18
  non-visual E2E tests, three accessibility tests, and 20 visual comparisons; one live-only API-error
  visual is intentionally skipped in fixture verification.
- A local Pages-static `pnpm release:check` without Secret-generated JSON still fails exactly on the
  missing data directory by design; the positive Secret-backed gate is witnessed in GitHub Actions.
- The successful run was push-triggered on a weekend. It proves export and deployment wiring, but it
  is not evidence that the weekday cron has fired naturally yet.
- The provider's reported `basDt` remains authoritative. A 15:40 run never substitutes its generation
  date for a trade date, so a provider publication delay remains visible rather than appearing fresh.
- Codex's in-app Browser could not establish its trusted desktop connection. Production-static
  Chromium Playwright was used for the current rendered interaction, accessibility, privacy,
  responsive, console, and visual evidence.
- D1 writes are performed in bounded batches. A failure is now reported as partial and never green,
  but atomicity across every batch in one ingestion run is not guaranteed by the current schema.

## Next exact actions

1. Witness the next natural weekday `15:40 KST` scheduled run and confirm its conclusion and
   provider-reported `basDt` without assuming same-day availability.
2. Keep AdSense disabled until approval, complete slot configuration, and consent readiness.

## Latest screenshots

- Desktop task: `C:/Users/swk02/.codex/visualizations/2026/08/25/01a03b23-4840-7f33-a871-72cdbf582414/yangbok-completion-audit-20260826/18-final-desktop-task.png`
- Desktop result: `C:/Users/swk02/.codex/visualizations/2026/08/25/01a03b23-4840-7f33-a871-72cdbf582414/yangbok-completion-audit-20260826/19-final-desktop-result.png`
- Mobile task: `C:/Users/swk02/.codex/visualizations/2026/08/25/01a03b23-4840-7f33-a871-72cdbf582414/yangbok-completion-audit-20260826/20-final-mobile-task.png`
- Mobile validation: `C:/Users/swk02/.codex/visualizations/2026/08/25/01a03b23-4840-7f33-a871-72cdbf582414/yangbok-completion-audit-20260826/21-final-mobile-validation.png`
- Mobile full result: `C:/Users/swk02/.codex/visualizations/2026/08/25/01a03b23-4840-7f33-a871-72cdbf582414/yangbok-completion-audit-20260826/22-final-mobile-result.png`
- Mobile actual-only result: `C:/Users/swk02/.codex/visualizations/2026/08/25/01a03b23-4840-7f33-a871-72cdbf582414/yangbok-completion-audit-20260826/23-final-mobile-actual-only.png`
- Mobile products: `C:/Users/swk02/.codex/visualizations/2026/08/25/01a03b23-4840-7f33-a871-72cdbf582414/yangbok-completion-audit-20260826/24-final-mobile-products.png`
- Approved regression set: `tests/e2e/visual.spec.ts-snapshots/`
