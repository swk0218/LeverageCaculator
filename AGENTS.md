# 양복음복 Agent Guide

## Structure

- `apps/web`: Astro static pages and the React calculator island.
- `apps/worker`: Cloudflare Worker API, scheduled ingestion, and D1 migrations.
- `packages/calculation-core`: framework-free calculation engine and formatting.
- `packages/contracts`: runtime API/data validation and the verified product master.
- `tests`: browser, accessibility, privacy, and visual checks.

Use pnpm 11 and Node 24. Run `pnpm verify:quick` for a small change and `pnpm verify` before handoff. Calculation changes require `pnpm test:core`; adapter changes require `pnpm test:contracts` and `pnpm test:integration`. UI changes require 360, 390, 430, 768, 1280, and 1440px checks.

Never send purchase dates, prices, quantities, averages, P/L, returns, or manually entered prices outside the browser. Never commit secrets, `.env`, or `.dev.vars`. Resume work from the first unfinished item in `docs/STATUS.md`.

## Astryx

<!-- ASTRYX:START -->

Astryx v0.5.0 is the UI foundation. Load `@astryxdesign/core/reset.css`,
`@astryxdesign/core/astryx.css`, and the neutral theme CSS before local styles.
Inspect component contracts with `pnpm astryx component <Name>` and validate setup
with `pnpm astryx doctor`; do not guess component props.

Use `@astryxdesign/core` and the neutral theme as the UI foundation. Inspect component APIs with `pnpm astryx component <Name>` instead of guessing. Use Astryx tokens first and keep the product's bright, minimal finance theme in `apps/web/src/styles/global.css`; the earlier pixel/game direction is retired.
<!-- ASTRYX:END -->
