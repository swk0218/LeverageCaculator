# Current Status

- Current milestone: P9 Pages-static release candidate — local verification complete; live Actions/Pages witness pending
- Last completed milestone: official-data static export, 15:40 KST scheduling, and Pages release hardening
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
  and advertising gates and fails closed locally only because Secret-generated official JSON is absent.
- Current-run 1440px and 390px rendered task, validation, full-result, partial-result, and product-list
  states were inspected. Browser console warnings/errors were zero.

## In progress

- The approved `DATA_GO_KR_SERVICE_KEY` is registered as one repository Actions Secret; its value was
  not read or copied.
- A PR, CI run, live 18-product export, Pages deployment, and deployed-data/browser smoke are the
  remaining release evidence.

## External or excluded scope

- AdSense remains disabled until approval, complete slot configuration, and consent readiness exist.
- Cloudflare Worker/D1, backfill, CORS, and remote migrations are optional expansion work, not blockers
  for the GitHub Pages-static release.

## Known failures and evidence boundaries

- `pnpm verify` passes with 87 unit/contract/web/Worker tests, one Workerd+D1 integration test, 18
  non-visual E2E tests, three accessibility tests, and 20 visual comparisons; one live-only API-error
  visual is intentionally skipped in fixture verification.
- A local Pages-static `pnpm release:check` without Secret-generated JSON fails exactly on the missing
  data directory. The positive live release gate must be witnessed in GitHub Actions.
- Until that run succeeds, the existing GitHub Pages fixture preview must not be treated as evidence
  of this revision.
- Codex's in-app Browser could not establish its trusted desktop connection. Production-static
  Chromium Playwright was used for the current rendered interaction, accessibility, privacy,
  responsive, console, and visual evidence.
- D1 writes are performed in bounded batches. A failure is now reported as partial and never green,
  but atomicity across every batch in one ingestion run is not guaranteed by the current schema.

## Next exact actions

1. Commit the reviewed release candidate, open a PR, and require CI to pass.
2. Merge the PR and witness the push-triggered official-data export, Pages release gate, and deploy.
3. Verify a representative static JSON, its actual `basDt`, the public 390px/1440px UI, console, and
   privacy boundary.
4. Leave AdSense disabled until approval and consent readiness.

## Latest screenshots

- Desktop task: `C:/Users/swk02/.codex/visualizations/2026/08/25/01a03b23-4840-7f33-a871-72cdbf582414/yangbok-completion-audit-20260826/18-final-desktop-task.png`
- Desktop result: `C:/Users/swk02/.codex/visualizations/2026/08/25/01a03b23-4840-7f33-a871-72cdbf582414/yangbok-completion-audit-20260826/19-final-desktop-result.png`
- Mobile task: `C:/Users/swk02/.codex/visualizations/2026/08/25/01a03b23-4840-7f33-a871-72cdbf582414/yangbok-completion-audit-20260826/20-final-mobile-task.png`
- Mobile validation: `C:/Users/swk02/.codex/visualizations/2026/08/25/01a03b23-4840-7f33-a871-72cdbf582414/yangbok-completion-audit-20260826/21-final-mobile-validation.png`
- Mobile full result: `C:/Users/swk02/.codex/visualizations/2026/08/25/01a03b23-4840-7f33-a871-72cdbf582414/yangbok-completion-audit-20260826/22-final-mobile-result.png`
- Mobile actual-only result: `C:/Users/swk02/.codex/visualizations/2026/08/25/01a03b23-4840-7f33-a871-72cdbf582414/yangbok-completion-audit-20260826/23-final-mobile-actual-only.png`
- Mobile products: `C:/Users/swk02/.codex/visualizations/2026/08/25/01a03b23-4840-7f33-a871-72cdbf582414/yangbok-completion-audit-20260826/24-final-mobile-products.png`
- Approved regression set: `tests/e2e/visual.spec.ts-snapshots/`
