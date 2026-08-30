# Quality Assurance

## Release verdict

The production release passes every local product, calculation, Worker, privacy, accessibility,
build, and visual gate. The approved key is registered as a GitHub Actions Secret. Main CI, the
live 18-product export, Pages deployment, and hosted 390px/1440px smoke are witnessed. AdSense stays
disabled.

## Automated evidence

| Gate                              | Current result                                                       |
| --------------------------------- | -------------------------------------------------------------------- |
| `pnpm verify:quick`               | PASS: format, lint, strict TypeScript, core 30/30, contracts 29/29   |
| `pnpm test`                       | PASS: 9 files, 87/87 tests                                           |
| Core coverage                     | PASS: 99.34% statements, 97.87% branches, 100% functions, 100% lines |
| Workerd + local D1 integration    | PASS: 1/1 runtime test                                               |
| `pnpm test:e2e`                   | PASS: 18/18 production-static Chromium scenarios                     |
| `pnpm test:a11y`                  | PASS: 3/3; all axe WCAG violation severities: 0                      |
| `pnpm test:visual`                | PASS: 20/20 fixture comparisons; one intentional live-only skip      |
| `pnpm audit --audit-level high`   | PASS: no known vulnerabilities                                       |
| Pages-static `pnpm release:check` | PASS in Secret-backed Actions; fail-closed without generated JSON    |
| `pnpm astryx doctor`              | PASS: 6 checks, 0 warnings, 0 failures                               |

The calculation suite contains the required rise, rise/fall, inverse -2X, multiple-lot, date,
common-analysis-date, missing-intermediate-date, and partial-analysis vectors. Property tests cover
break-even reconstruction, aggregation, finite values, signs, and formatting. Provider contracts
reject malformed and out-of-request-range FSC records. Worker tests cover bodyless backfill,
per-product health coverage, last-sync state, empty responses, and partial ingestion failure.

## Product-design audit

The review used the user-requested priorities: information hierarchy, UX convenience,
accessibility, intuitiveness, and separation of necessary from unnecessary content.

### Information hierarchy

- The primary sequence is now `상품 → 매수내역 → 현재가 → 계산 → 결과`; the page no longer opens
  with a long marketing hero or numbered/game-like decoration.
- Initial totals use an honest empty state instead of three misleading zero values.
- Actual-only products show the two valid result metrics and one scope explanation. Repeated
  unavailable cards and the unsupported compound panel are not rendered.
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
- Axe is run without severity filtering on desktop initial/full-result states and on mobile
  validation/actual-only/product-list states. Current violations: 0.
- Responsive checks cover 360, 390, 430, 768, 1280, and 1440 pixels with no horizontal page overflow.

## Browser and visual verification

The in-app Browser was invoked first but could not establish its trusted desktop connection. The
current-run fallback is Playwright 1.62.1 Chromium against both a fresh production-static Astro
build and the deployed GitHub Pages origin. Server reuse is disabled for the automated suite.
Production smoke at 390px and 1440px completed product selection, purchase entry, and calculation
with zero console, page, request, or horizontal-overflow errors.

Current-run screenshots were inspected alongside their pre-audit counterparts at the same viewport
and state. The accepted change removes the oversized intro, initial zeros, single-row delete,
prominent destructive reset, developer `Fixture` wording, two inactive ad placeholders, repeated
unsupported results, and the long ungrouped mobile product list.

Approved Win32 visual baselines cover:

- initial at 360, 390, 430, 768, 1280, and 1440 pixels;
- three purchases, loss, profit, inverse, manual price, stale data, and actual-only at 390 and 1440;
- one separate live-only API-error baseline, intentionally skipped by normal fixture verification.

The accepted baseline command is:

```powershell
pnpm test:visual
```

## Functional and privacy coverage

The browser suite exercises search/selection, one-to-three purchase lots, totals, deletion,
recalculation, 1/5/20-day periods, opt-in storage/restore/removal, confirmed reset, official/manual
current price, inverse -2X, stale/actual-only states, future/non-trading dates, zero values,
keyboard-only completion, stale-result invalidation, and confirmed product switching.

Network interception seeds sentinel financial values and verifies that none appear in URLs, request
bodies, fetch/XHR/beacon calls, analytics, or ad traffic. Fixture mode issues no ad or analytics
request. The API accepts public product/date parameters only, rejects unknown fields and request
bodies where forbidden, binds SQL parameters, applies exact-origin CORS, and sanitizes errors.

## Production bundle and security review

The live-mode local build emits eight HTML pages plus robots, sitemap, and `_headers`. Current raw
static artifact totals are 790,724 bytes: 495,530 bytes JavaScript and 192,200 bytes CSS. The largest
client asset is the calculator island at 283,577 raw bytes. Static content stays in Astro HTML; no
chart or global-state library was added.

The release gate scans for fixture identifiers/copy, server-only secret names and values,
placeholder production identifiers, unintended `noindex`, unconsented ad code, TODO/FIXME markers,
policy routes, and migration requirements. All local checks pass.

`apps/web/public/_headers` now provides HSTS, nosniff, restrictive referrer/permissions/frame
policies, and a baseline CSP. The Worker provides CSP/nosniff for JSON responses. The current CSP
retains `unsafe-inline` only for existing inline site metadata/conditional scripts and lists the
prepared AdSense origins; real AdSense consent behavior and final-origin policy still require live
verification after approval. GitHub Pages support for `_headers` is not assumed.

## Remaining evidence boundaries

- Live FSC responses and latest dates are witnessed in Actions run `33314666328`: 18/18 payloads,
  1,152 price points, and provider-reported latest `basDt` `2026-08-27`. Ongoing quota behavior and
  exact underlying series remain external, so production products stay conservatively actual-only.
- D1 batch failure is surfaced as partial and never green, but one ingestion run is not atomic across
  every bounded batch.
- GitHub Pages browser behavior is witnessed. Worker-origin headers/CSP/CORS and AdSense consent
  remain unwitnessed because those optional services are not deployed or enabled.
- Main CI run `33314666323` and Pages run `33314666328` passed. The first natural weekday `15:40 KST`
  cron firing remains an operational recurrence check; the successful run was push-triggered.

## Current screenshot paths

- Desktop task: `C:/Users/swk02/.codex/visualizations/2026/08/25/01a03b23-4840-7f33-a871-72cdbf582414/yangbok-completion-audit-20260826/18-final-desktop-task.png`
- Desktop result: `C:/Users/swk02/.codex/visualizations/2026/08/25/01a03b23-4840-7f33-a871-72cdbf582414/yangbok-completion-audit-20260826/19-final-desktop-result.png`
- Desktop products: `C:/Users/swk02/.codex/visualizations/2026/08/25/01a03b23-4840-7f33-a871-72cdbf582414/yangbok-completion-audit-20260826/25-final-desktop-products.png`
- Mobile task: `C:/Users/swk02/.codex/visualizations/2026/08/25/01a03b23-4840-7f33-a871-72cdbf582414/yangbok-completion-audit-20260826/20-final-mobile-task.png`
- Mobile validation: `C:/Users/swk02/.codex/visualizations/2026/08/25/01a03b23-4840-7f33-a871-72cdbf582414/yangbok-completion-audit-20260826/21-final-mobile-validation.png`
- Mobile full result: `C:/Users/swk02/.codex/visualizations/2026/08/25/01a03b23-4840-7f33-a871-72cdbf582414/yangbok-completion-audit-20260826/22-final-mobile-result.png`
- Mobile actual-only: `C:/Users/swk02/.codex/visualizations/2026/08/25/01a03b23-4840-7f33-a871-72cdbf582414/yangbok-completion-audit-20260826/23-final-mobile-actual-only.png`
- Mobile products: `C:/Users/swk02/.codex/visualizations/2026/08/25/01a03b23-4840-7f33-a871-72cdbf582414/yangbok-completion-audit-20260826/24-final-mobile-products.png`
