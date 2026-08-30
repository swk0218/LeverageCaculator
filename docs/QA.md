# Quality Assurance

## Release verdict

The 18-product full-analysis release candidate passes every local product, calculation, Worker,
privacy, accessibility, build, and visual gate. All products now support Samsung Electronics or SK
hynix stock target-price and compound analysis; futures/TR products disclose that the stock series is
a reference proxy rather than the futures/TR original-index basis used for daily target-multiple
calculation. The approved key remains registered as a
GitHub Actions Secret. The previous Pages release is witnessed; the full-analysis revision still
requires its own Actions export/deployment witness. AdSense stays disabled.

## Automated evidence

| Gate                              | Current result                                                     |
| --------------------------------- | ------------------------------------------------------------------ |
| `pnpm verify:quick`               | PASS: format, lint, strict TypeScript, core 30/30, contracts 37/37 |
| Vitest suite                      | PASS: 10 files, 106/106 tests                                      |
| Workerd + local D1 integration    | PASS: 2/2 runtime tests                                            |
| `pnpm test:e2e`                   | PASS: 21/21 production-static Chromium scenarios                   |
| `pnpm test:a11y`                  | PASS: 5/5; all axe WCAG violation severities: 0                    |
| `pnpm test:visual`                | PASS: 20/20 fixture comparisons; one intentional live-only skip    |
| Production build / Worker dry-run | PASS                                                               |
| `pnpm audit --audit-level high`   | PASS: no known vulnerabilities                                     |
| Release-check contract tests      | PASS in current Vitest; Secret-backed candidate rerun due          |
| `pnpm astryx doctor`              | PASS: 6 checks, 0 warnings, 0 failures                             |

The calculation suite contains exact won-denominated target-price vectors for 1/5/20 days, rise,
rise/fall, inverse -2X, favorable and unfavorable compounding, multiple lots, common analysis dates,
missing intermediate dates, and partial analysis. Property tests cover break-even reconstruction,
aggregation, finite values, signs, and formatting. Provider contracts reject malformed,
out-of-request-range, empty, identity-mismatched, count-mismatched, and no-common-date FSC records.
Worker tests cover bodyless backfill, shared stock assets, migrated D1 mappings, per-product health,
last-sync state, empty responses, and partial ingestion failure.

## Product-design audit

The review used the user-requested priorities: information hierarchy, UX convenience,
accessibility, intuitiveness, and separation of necessary from unnecessary content.

### Information hierarchy

- The primary sequence is now `상품 → 매수내역 → 현재가 → 계산 → 결과`; the page no longer opens
  with a long marketing hero or numbered/game-like decoration.
- Initial totals use an honest empty state instead of three misleading zero values.
- All 18 production products expose target-price and compound panels. Spot ETFs are labeled as
  direct stock-basis analysis; futures ETFs and ETNs are labeled `본주 환산 참고` and retain the
  separate futures/TR original-index basis used to define their daily target multiple.
- Actual-only remains a fail-closed fallback for incomplete or unverified data. In that state, only
  valid metrics and one scope explanation render; unsupported panels stay hidden.
- Detailed P/L is collapsed by default, while the decision-making summary stays visible.
- Mobile supported products are grouped by underlying asset and can be expanded independently.

### Convenience and intuitiveness

- The calculator is a native form: Enter submits, incomplete submission focuses the first missing
  field, and every missing value gets a local explanation.
- Product change and destructive reset require confirmation when position data would be lost.
- Adding or removing a row invalidates stale results and restores focus to the useful next control.
- Manual current price has a draft, Apply, Cancel, and return-to-official-price path; uncommitted
  typing no longer changes calculations.
- Input persistence is off by default. Users may opt into this-device storage for up to 30 days and
  can remove it from the same task area.
- Inactive ad slots render nothing. Public UI contains no API-key or deployment setup instructions.

### Accessibility

- Labels, field-level error relationships, logical tab order, visible focus, native disclosure,
  result/error focus recovery, reduced motion, forced-colors treatment, and minimum touch targets
  are verified.
- Financial meaning is not color-only: signed values and explanatory text accompany red/green;
  break-even burden uses a neutral treatment.
- Axe is run without severity filtering across initial, direct full-result, inverse proxy-result,
  validation, actual-only fallback, and product-list states. Proxy results pass at both 390px and
  1440px. Current violations: 0.
- Responsive checks cover 360, 390, 430, 768, 1280, and 1440 pixels with no horizontal page overflow.

## Browser and visual verification

The in-app Browser was invoked first but could not establish its trusted desktop connection. The
current P10 fallback is Playwright 1.62.1 Chromium against a fresh production-static Astro build;
server reuse is disabled for the automated suite. The deployed-origin smoke at 390px and 1440px is
evidence for the prior Pages release, not yet for P10. It completed product selection, purchase
entry, and calculation with zero console, page, request, or horizontal-overflow errors.

Current-run screenshots were inspected alongside their pre-audit counterparts at the same viewport
and state. The accepted change removes the oversized intro, initial zeros, single-row delete,
prominent destructive reset, developer `Fixture` wording, two inactive ad placeholders, repeated
unsupported results, and the long ungrouped mobile product list.

Approved Win32 visual baselines cover:

- initial at 360, 390, 430, 768, 1280, and 1440 pixels;
- three purchases, loss, profit, inverse proxy, manual price, stale data, and actual-only fallback at
  390 and 1440;
- one separate live-only API-error baseline, intentionally skipped by normal fixture verification.

The accepted baseline command is:

```powershell
pnpm test:visual
```

## Functional and privacy coverage

The browser suite exercises search/selection, one-to-three purchase lots, totals, deletion,
recalculation, exact 1/5/20-day stock target prices, favorable/unfavorable compound effects, opt-in
storage/restore/removal, confirmed reset, official/manual current price, inverse -2X proxy labels,
stale/actual-only fallback states, future/non-trading dates, zero values, keyboard-only completion,
stale-result invalidation, and confirmed product switching.

Network interception seeds sentinel financial values and verifies that none appear in URLs, request
bodies, fetch/XHR/beacon calls, analytics, or ad traffic. Fixture mode issues no ad or analytics
request. The API accepts public product/date parameters only, rejects unknown fields and request
bodies where forbidden, binds SQL parameters, applies exact-origin CORS, and sanitizes errors.

## Production bundle and security review

The live-mode local build emits eight HTML pages plus robots, sitemap, and `_headers`. The current
production build passes; static content stays in Astro HTML and no chart or global-state library was
added. Exact prior bundle byte counts are not reused as evidence for the changed P10 build.

The release gate scans for fixture identifiers/copy, server-only secret names and values,
placeholder production identifiers, unintended `noindex`, unconsented ad code, TODO/FIXME markers,
policy routes, and migration requirements. All local checks pass.

`apps/web/public/_headers` now provides HSTS, nosniff, restrictive referrer/permissions/frame
policies, and a baseline CSP. The Worker provides CSP/nosniff for JSON responses. The current CSP
retains `unsafe-inline` only for existing inline site metadata/conditional scripts and lists the
prepared AdSense origins; real AdSense consent behavior and final-origin policy still require live
verification after approval. GitHub Pages support for `_headers` is not assumed.

## Remaining evidence boundaries

- The prior product-price-only FSC export is witnessed in Actions run `33314666328`: 18/18 payloads,
  1,152 price points, and provider-reported latest `basDt` `2026-08-27`. The current candidate pins
  all 18 product-to-stock mappings, requires non-empty identity/count-matched series and a common
  date before publishing, and fails closed otherwise. Its Secret-backed Pages export is the remaining
  live evidence gate.
- Ten spot ETFs use the official Samsung Electronics/SK hynix stock series as the direct analysis
  basis. Six futures ETFs and two ETNs use it only as a disclosed reference proxy; futures
  basis/rollover and TR dividend reinvestment mean their results are not exact original-index or product forecasts.
- D1 batch failure is surfaced as partial and never green, but one ingestion run is not atomic across
  every bounded batch.
- GitHub Pages browser behavior is witnessed. Worker-origin headers/CSP/CORS and AdSense consent
  remain unwitnessed because those optional services are not deployed or enabled.
- Main CI run `33314666323` and Pages run `33314666328` passed. The first natural weekday `15:40 KST`
  cron firing remains an operational recurrence check; the successful run was push-triggered.

## Screenshot evidence

Current accepted visual evidence is the updated set under
`tests/e2e/visual.spec.ts-snapshots/`. The completion-audit paths below predate full production mapping
and retain an actual-only fallback screenshot for negative-state coverage.

- Desktop task: `C:/Users/swk02/.codex/visualizations/2026/08/25/01a03b23-4840-7f33-a871-72cdbf582414/yangbok-completion-audit-20260826/18-final-desktop-task.png`
- Desktop result: `C:/Users/swk02/.codex/visualizations/2026/08/25/01a03b23-4840-7f33-a871-72cdbf582414/yangbok-completion-audit-20260826/19-final-desktop-result.png`
- Desktop products: `C:/Users/swk02/.codex/visualizations/2026/08/25/01a03b23-4840-7f33-a871-72cdbf582414/yangbok-completion-audit-20260826/25-final-desktop-products.png`
- Mobile task: `C:/Users/swk02/.codex/visualizations/2026/08/25/01a03b23-4840-7f33-a871-72cdbf582414/yangbok-completion-audit-20260826/20-final-mobile-task.png`
- Mobile validation: `C:/Users/swk02/.codex/visualizations/2026/08/25/01a03b23-4840-7f33-a871-72cdbf582414/yangbok-completion-audit-20260826/21-final-mobile-validation.png`
- Mobile full result: `C:/Users/swk02/.codex/visualizations/2026/08/25/01a03b23-4840-7f33-a871-72cdbf582414/yangbok-completion-audit-20260826/22-final-mobile-result.png`
- Mobile actual-only fallback: `C:/Users/swk02/.codex/visualizations/2026/08/25/01a03b23-4840-7f33-a871-72cdbf582414/yangbok-completion-audit-20260826/23-final-mobile-actual-only.png`
- Mobile products: `C:/Users/swk02/.codex/visualizations/2026/08/25/01a03b23-4840-7f33-a871-72cdbf582414/yangbok-completion-audit-20260826/24-final-mobile-products.png`
