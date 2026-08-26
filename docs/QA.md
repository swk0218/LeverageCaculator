# Quality Assurance

## Release verdict

The fixture-mode production release candidate passes every local gate. Live public-data verification
and Cloudflare deployment are separately blocked by credentials and final URLs; they were not
simulated or reported as complete.

## Automated evidence

| Gate                            | Result                                                               |
| ------------------------------- | -------------------------------------------------------------------- |
| `pnpm verify:quick`             | PASS: format, lint, strict TypeScript, core 27/27, contracts 17/17   |
| `pnpm test`                     | PASS: 6 files, 54/54 tests                                           |
| Core coverage                   | PASS: 99.31% statements, 98.23% branches, 100% functions, 100% lines |
| Workerd + local D1 integration  | PASS: 1/1 runtime test                                               |
| `pnpm test:e2e`                 | PASS: 13/13 production-static Chromium scenarios                     |
| `pnpm test:a11y`                | PASS: 2/2; serious/critical axe violations: 0                        |
| `pnpm test:visual`              | PASS: 20 fixture comparisons; one intentional live-only skip         |
| Live API-error visual           | PASS: 1/1 with explicit live-mode opt-in and intercepted request     |
| `pnpm audit --audit-level high` | PASS: no known vulnerabilities                                       |
| `pnpm release:check`            | LOCAL GATES PASS; exit 2 with ten external prerequisites             |
| `pnpm astryx doctor`            | PASS: 6 checks, 0 warnings, 0 failures                               |

The calculation suite includes all required golden vectors (consecutive rise, rise-then-fall,
inverse -2X, positive and negative compound effect, multiple lots, date inclusion, common analysis
date, partial analysis) plus property tests for break-even reconstruction, aggregation, finite
output, sign behavior, and formatting. Provider contracts also cover bounded retry for both HTTP
errors and HTTP-200 FSC error envelopes, including a timeout while reading the response body.

## Browser and viewport verification

The native in-app Browser bootstrap was attempted first and returned `Invocation failed` because
`privileged native pipe bridge is not available; browser-client is not trusted`. This is a tooling
restriction, not an application failure. The fallback was Playwright 1.62.1 with Chromium against a
fresh production-static Astro build served on `127.0.0.1:4387`; server reuse is disabled so a stale
development page cannot satisfy a release run.

Native-size captures and interaction checks cover:

- 360×800
- 390×844
- 430×932
- 768×1024
- 1280×900
- 1440×1000

Verified states are initial, three purchases, loss, profit, inverse, manual current price, stale
data, partial analysis, and API error. Across the six responsive widths there is no horizontal page
overflow; result-heavy 360px content remains contained; primary controls meet the 44px touch target;
ads do not overlap the calculator; and captured browser console errors are zero.

## Functional and privacy coverage

The browser suite exercises product name/code search, product selection, one to three purchase rows,
live average/quantity/cost totals, middle-row deletion, recalculation, 1/5/20-day break-even periods,
localStorage restore and reset, official/manual current-price distinction, inverse -2X, stale and
actual-only results, invalid/future/non-trading dates, zero values, keyboard-only calculation, and
result focus/announcement.

Network interception seeds sentinel financial values and asserts that none appear in URLs, request
bodies, fetch/XHR/beacon calls, analytics, or advertising. Fixture mode produces no external ad or
analytics request. The API accepts only public product codes and date ranges, rejects unknown query
fields, uses parameter-bound SQL, exact-origin CORS, bounded upstream retry/timeout, and sanitized
error responses.

## Visual fidelity ledger

Accepted reference: the public Meta Astryx design-system landing experience, preserved at
`C:/Users/swk02/.codex/visualizations/2026/08/25/01a03b23-4840-7f33-a871-72cdbf582414/astryx-reference-1440.png`.
The reference and implementation captures were both inspected with the local image viewer. The
implementation pair reviewed at native sizes is:

- `tests/e2e/visual.spec.ts-snapshots/initial-1440-chromium-win32.png`
- `tests/e2e/visual.spec.ts-snapshots/loss-result-390-chromium-win32.png`

Five-point fidelity assessment:

1. Warm neutral canvas, clean high contrast, and calm surface hierarchy follow the accepted Astryx
   character.
2. Astryx reset, neutral theme, Button component, tokens, focus behavior, and spacing form the UI
   foundation rather than a look-alike component library.
3. Black flat controls and a restrained accent preserve the reference's decisive action hierarchy.
4. Strong typography and generous section whitespace keep dense financial information legible.
5. Responsive stacking, explicit labels, visible focus, semantic signs, and reduced-motion support
   preserve clarity from 360px through 1440px.

Intentional product deviations are the Korean pixel-ant identity, crisp one-to-two-pixel borders and
small hard shadows, compact calculator-first density instead of a marketing hero, and red/blue
financial semantics reinforced by signs and sentences. No Astryx marketing copy was reused; all
product copy is original Korean written for the calculator.

## Approved visual baselines

`tests/e2e/visual.spec.ts-snapshots/` contains 21 reviewed Win32 Chromium PNGs:

- initial at all six required viewports;
- three-purchase, loss, profit, inverse, manual-price, stale-data, and partial-analysis at 390px and
  1440px;
- the explicit live API-error state at 390px.

Fixture comparisons run normally with:

```powershell
pnpm test:visual
```

The API-error baseline is deliberately opt-in so fixture mode cannot masquerade as a server error:

```powershell
$env:PUBLIC_DATA_MODE = 'live'
$env:E2E_LIVE_ERROR_STATE = '1'
pnpm exec playwright test tests/e2e/visual.spec.ts --grep "API error at 390px"
Remove-Item Env:PUBLIC_DATA_MODE
Remove-Item Env:E2E_LIVE_ERROR_STATE
```

## Production bundle review

The live build statically emits eight pages plus robots and sitemap. The last inspected asset set was
approximately 664KB raw JS/CSS before compression: calculator island 266KB raw/74KB gzip, shared
client 181KB/57KB gzip, BaseLayout CSS 168KB/30KB gzip, and calculator CSS 18KB/4KB gzip. There is no
chart library or global state package. Static pages remain HTML and only the calculator hydrates.
An unused 580KB generated PNG was removed; the visible brand is text plus a tiny inline SVG, so the
artifact is not shipped.

The release build is also scanned for fixture identifiers/copy, server-only secret names and values,
placeholder production identifiers, unintended `noindex`, unconsented ad code, unreviewed TODO/FIXME
markers, policy routes, and migration schema requirements.

## Security-header deployment plan

Cloudflare should add `X-Content-Type-Options: nosniff`, a restrictive `Referrer-Policy`,
`Permissions-Policy`, frame protection, and a CSP after the final Pages/Worker origins and optional
AdSense domains are known. The CSP must keep `default-src`, `base-uri`, `object-src`,
`frame-ancestors`, and `form-action` restrictive, explicitly list the final API under `connect-src`,
and include Google advertising origins only after approval/consent. This final-domain-dependent step
is part of the live launch checklist rather than a permissive placeholder policy in source.
