# Current Status

- Current milestone: P10 stock-reference analysis — implementation and local release verification complete
- Last completed milestone: 18-product Samsung Electronics/SK hynix target-price and compound analysis
- Quick verification command: `pnpm verify:quick`
- Full verification command: `pnpm verify`

## Completed

- P0–P9 implementation is complete: Astro/React web app, pure calculation engine, contracts,
  official-data adapter, Cloudflare Worker, D1, scheduled ingestion, content, policy pages, SEO,
  advertising gates, tests, CI configuration, and deployment instructions.
- All 18 production products now have a validated analysis series. The ten spot ETFs use the exact
  Samsung Electronics (`005930`) or SK hynix (`000660`) official stock-close series as their direct
  analysis basis. Six futures ETFs and two ETNs preserve the futures/TR original-index basis used to
  define their daily target multiple while using the corresponding official stock series only as a
  clearly labeled `reference-stock-proxy` for won-denominated target-price analysis.
- Results now expose the 1/5/20-day stock target price in won and compare simple leveraged return,
  equal-daily compounding, actual product performance, favorable/unfavorable compound effect, and
  actual-versus-theory gap. Futures/TR products label these outputs `본주 환산` and disclose the
  futures basis/rollover or TR dividend-reinvestment limitation.
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
- `pnpm verify` passes: format, lint, strict types, 106 Vitest tests across ten files, two Workerd+D1
  runtime tests, production build, Worker dry-run, 21 non-visual E2E tests, five accessibility tests
  covering all axe WCAG violation severities, and 20 fixture visual comparisons. The live-only
  API-error visual is intentionally skipped in fixture verification.
- `pnpm verify:quick` separately passes all 30 calculation-core and 37 contract/provider tests.
- `pnpm audit --audit-level high` reports no known vulnerabilities.
- The prior Pages-static `pnpm release:check` passed its environment, workflow, build, security,
  privacy, SEO, and advertising gates with Secret-generated official JSON. The P10 mapping/export
  contract is covered locally; its live Actions invocation remains the deployment gate.
- Current-run rendered direct/proxy result states were inspected at 390px and 1440px. Responsive proxy
  flows pass at 360, 390, 430, 768, 1280, and 1440px without horizontal overflow; proxy result axe
  checks pass at both 390px and 1440px.
- PRs #1–#3 were merged after CI. Main CI run `33314666323` passed `pnpm verify`, and Pages run
  `33314666328` generated, validated, uploaded, and deployed the official-data artifact successfully.
- The prior public baseline and all 18 product payloads were fetched successfully. That payload set contains
  1,152 official price points, preserves the provider's actual latest `basDt` (`2026-08-27` for this
  run), and contains no service key or upstream URL marker. A new Pages run must separately witness
  the added stock series and full-analysis payload contract before those are described as live.
- The prior deployed-release Chromium smoke at 390px and 1440px completed product selection,
  purchase entry, and calculation with zero console, page, request, or horizontal-overflow errors.
  P10's current rendered evidence is production-static/local until its Pages deployment completes.

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

- `pnpm verify` passes with 106 Vitest tests, two Workerd+D1 runtime tests, 21 non-visual E2E tests,
  five accessibility tests, and 20 visual comparisons; one live-only API-error visual is
  intentionally skipped in fixture verification.
- A local Pages-static `pnpm release:check` without Secret-generated JSON still fails exactly on the
  missing data directory by design; the positive Secret-backed gate is witnessed in GitHub Actions.
- The successful run was push-triggered on a weekend. It proves export and deployment wiring, but it
  is not evidence that the weekday cron has fired naturally yet.
- The provider's reported `basDt` remains authoritative. A 15:40 run never substitutes its generation
  date for a trade date, so a provider publication delay remains visible rather than appearing fresh.
- The six futures ETFs and two ETNs are not claimed to be exact futures-index/TR-index reconstructions.
  Their won target and compounding panels use the official underlying-company stock close as a
  disclosed reference proxy; futures basis/rollover and TR dividend reinvestment can create material
  differences from the original-index daily target and the product.
- Codex's in-app Browser could not establish its trusted desktop connection. Production-static
  Chromium Playwright was used for the current rendered interaction, accessibility, privacy,
  responsive, console, and visual evidence.
- D1 writes are performed in bounded batches. A failure is now reported as partial and never green,
  but atomicity across every batch in one ingestion run is not guaranteed by the current schema.

## Next exact actions

1. Deploy the full-analysis revision and witness all 18 public payloads with non-empty, correctly
   identified stock series, a common analysis date, and no secret/upstream leakage.
2. Witness the next natural weekday `15:40 KST` scheduled run and confirm its conclusion and
   provider-reported `basDt` without assuming same-day availability.
3. Keep AdSense disabled until approval, complete slot configuration, and consent readiness.

## Screenshot evidence

The current accepted responsive/proxy regression images are under
`tests/e2e/visual.spec.ts-snapshots/`. The absolute paths below are the earlier completion-audit
references and include the intentionally retained actual-only fallback state; they are not evidence
that production products remain actual-only.

- Desktop task: `C:/Users/swk02/.codex/visualizations/2026/08/25/01a03b23-4840-7f33-a871-72cdbf582414/yangbok-completion-audit-20260826/18-final-desktop-task.png`
- Desktop result: `C:/Users/swk02/.codex/visualizations/2026/08/25/01a03b23-4840-7f33-a871-72cdbf582414/yangbok-completion-audit-20260826/19-final-desktop-result.png`
- Mobile task: `C:/Users/swk02/.codex/visualizations/2026/08/25/01a03b23-4840-7f33-a871-72cdbf582414/yangbok-completion-audit-20260826/20-final-mobile-task.png`
- Mobile validation: `C:/Users/swk02/.codex/visualizations/2026/08/25/01a03b23-4840-7f33-a871-72cdbf582414/yangbok-completion-audit-20260826/21-final-mobile-validation.png`
- Mobile full result: `C:/Users/swk02/.codex/visualizations/2026/08/25/01a03b23-4840-7f33-a871-72cdbf582414/yangbok-completion-audit-20260826/22-final-mobile-result.png`
- Mobile actual-only fallback result: `C:/Users/swk02/.codex/visualizations/2026/08/25/01a03b23-4840-7f33-a871-72cdbf582414/yangbok-completion-audit-20260826/23-final-mobile-actual-only.png`
- Mobile products: `C:/Users/swk02/.codex/visualizations/2026/08/25/01a03b23-4840-7f33-a871-72cdbf582414/yangbok-completion-audit-20260826/24-final-mobile-products.png`
- Approved regression set: `tests/e2e/visual.spec.ts-snapshots/`
