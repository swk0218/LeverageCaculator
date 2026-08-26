# Engineering Decisions

## 2026-08-26 — Workspace architecture

Use a pnpm workspace with Astro static pages, one React calculator island, a standalone Cloudflare Worker, D1 migrations, and framework-free core/contracts packages. This follows the product specification and keeps private position calculations client-only.

## 2026-08-26 — Astryx design system

Use Meta's MIT-licensed Astryx 0.5.0 packages with React 19 and its neutral theme. The later user instruction supersedes the earlier preference to avoid a UI framework. Astryx owns accessible controls and structural tokens; a small local theme layer adds the requested bright, minimal glass surfaces without forking Astryx. The earlier game/pixel direction is retired.

The framework-free financial package is stored in `packages/calculation-core` while retaining the package name `@yangbok/core`. Astryx 0.5.0 deliberately treats a repository path named `packages/core` as Astryx's own source package; avoiding that path keeps `pnpm astryx doctor` and component contract lookup accurate without patching vendor code.

## 2026-08-26 — Fixture-first release candidate

All development and automated verification use sanitized, deterministic fixture price data. Production release checks fail closed when `PUBLIC_DATA_MODE=fixture`. Live provider code and Cloudflare configuration are implemented, while credential-dependent verification is reported separately.

## 2026-08-26 — Evidence-conservative product capabilities

The production product master includes only products supported by current official issuer or KRX evidence. Every production entry remains `actual-only` until a valid Public Data Portal credential is used to capture and confirm the precise underlying series returned by the documented index operations. This prevents the calculator from silently applying leverage twice to an index that is itself already leveraged. Synthetic catalog rows use the explicit `product-master-unverified-series` lineage; it is not a verified price-series claim. Clearly named fixture-only +2X and -2X products provide full positive and negative compound-effect paths without weakening the production evidence standard.

## 2026-08-26 — Server data boundary

Worker routes accept only product identifiers and public date ranges. Purchase dates, purchase prices, quantities, average costs, manually entered prices, profit/loss, and returns have no request fields and are rejected as unknown query values. These values stay inside the browser calculator. The Worker also uses an exact origin allowlist, sanitized error messages, bounded upstream timeout/retry behavior, cache freshness metadata, and authenticated bodyless backfills.

## 2026-08-26 — Environment and release isolation

The default Worker is named `yangbok-eumbok-api-fixture-dev`, remains fixture-only, and keeps an
inert remote D1 ID unless a separate development database is intentionally supplied. Production is
the distinct `yangbok-eumbok-api` environment and must never share its D1 with the fixture Worker.

`pnpm release:check` is fail-closed: an active fixture mode is a local failure, missing external
credentials/configuration return exit 2, and only a fully supplied live release returns 0. The gate
requires canonical HTTPS origins, matching build/Worker site origins, strong non-placeholder
credentials, distinct environment identities, the production cron, both Worker secrets, and a
non-nil production D1 UUID.
