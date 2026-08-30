# Data Sources and Quality

Production uses Financial Services Commission public-data APIs through a validated GitHub Actions static export. Browser code receives only public JSON; it never receives the service key or calls the upstream provider directly. The optional Worker/D1 path uses the same adapter contracts and preserves stored good rows when an upstream response is empty or malformed.

Fixture mode is deterministic and visibly labeled. It covers +2X, -2X, fresh, stale, mismatched dates, actual-only products, empty responses, malformed responses, and missing dates. Verified live operation names and mappings are documented alongside the adapter.

## Official upstream contracts

The adapter was checked against the Financial Services Commission documentation published on the Korean Public Data Portal on 2026-08-26:

| Dataset                                                                                 | Service path                      | Operations used                                          | Exact response fields consumed                                                |
| --------------------------------------------------------------------------------------- | --------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------- |
| [Stock security price information](https://www.data.go.kr/data/15094808/openapi.do)     | `GetStockSecuritiesInfoService`   | `getStockPriceInfo`                                      | `basDt`, `srtnCd`, `itmsNm`, `clpr`, optional `mkp`, `hipr`, `lopr`, `trqu`   |
| [Securities product price information](https://www.data.go.kr/data/15094806/openapi.do) | `GetSecuritiesProductInfoService` | `getETFPriceInfo`, `getETNPriceInfo`                     | common price fields plus the documented `bssIdxIdxNm` and `bssIdxClpr` fields |
| [Market index information](https://www.data.go.kr/data/15094807/openapi.do)             | `GetMarketIndexInfoService`       | `getStockMarketIndex`, `getDerivationProductMarketIndex` | `basDt`, `idxNm`, `clpr`, optional `mkp`, `hipr`, `lopr`, `trqu`              |

Requests send only the documented `serviceKey`, `resultType=json`, `numOfRows`, `pageNo`, `beginBasDt`, `endBasDt`, and the dataset-specific code/name filter. The official date contract treats `endBasDt` as an exclusive upper bound, so the adapter converts the app's inclusive `to` date to the following calendar day. It then exact-matches the returned code or index name to prevent a `like` filter from admitting a different instrument.

The upstream service is daily, not intraday. Stock and index pages state that data is updated after 13:00 on the next business day. The app schedules weekday ingestion only after the KRX close, at 15:40 KST (`06:40 UTC`), and always exposes the provider's actual `basDt` rather than treating the generation date as a trade date. The optional Worker path re-requests a rolling ten-calendar-day window. D1 upserts on `(asset_id, trade_date)`, making repeated runs idempotent. A valid empty response (`totalCount = 0`) records an empty sync but preserves the previous cache. Malformed, authentication, timeout, and provider errors fail the sync and also preserve the previous cache.

A push or manual Pages run before 15:40 KST is capped at the previous weekday, and a weekend run is
capped at Friday. An unscheduled deployment therefore cannot make the current trading session
eligible merely because it ran.

## Product master and analysis capability

The production master contains only entries supported by an official issuer notice, KRX KIND product page, or issuer product page. Codes are stored as the six-character short code returned in `srtnCd`. All 18 entries use exact stock-code matching for the user-facing analysis series: Samsung Electronics `005930` or SK hynix `000660`. This removes the former double-leverage risk from feeding an already leveraged or inverse reference index into the calculation core.

The ten spot ETFs use the stock series as their direct analysis basis. Six futures ETFs and two TR-index ETNs also expose the requested stock-price target and positive/negative compounding view, but carry `analysisBasis=reference-stock-proxy`. `baseIndexName` and `baseIndexType` identify the unlevered original index whose daily return defines the product's target multiple; they do not claim to be the product's formal leveraged or inverse reference-index name. UI and payload warnings state that futures basis/rollover or dividend-reinvestment differences are not represented by the raw share series. A future exact-index comparison would be an additional series, not a silent replacement of this stock-price view.

## Runtime modes and credentials

- `DATA_MODE=fixture` is the safe default and requires no network credential.
- Pages-static live mode receives `DATA_GO_KR_SERVICE_KEY` only in the GitHub Actions generation step. The optional Worker live mode requires the same value as a Wrangler secret. Never put it in `wrangler.jsonc`, `.env`, or `.dev.vars` committed to source control.
- `BACKFILL_TOKEN` protects `POST /api/v1/admin/backfill?from=YYYY-MM-DD&to=YYYY-MM-DD`.
- `PUBLIC_SITE_URL` and `ALLOWED_ORIGINS` form the exact CORS allowlist. Wildcard CORS is not used.
- Data is marked stale once the latest product price is at least two weekdays behind the current Seoul date. This is intentionally conservative and does not attempt to infer Korean exchange holidays.

The live adapter's operation names and field schemas are documentation-verified. End-to-end live payload validation remains credential-dependent; an invalid-key probe correctly returned the Public Data Portal `SERVICE_KEY_IS_NOT_REGISTERED_ERROR` envelope and no production data was fabricated from it.

For local D1 setup, run `pnpm db:migrate:local`, then `pnpm data:seed`. With `pnpm dev:worker` running, `pnpm data:sync:local` invokes the scheduled rolling sync. An explicit range can be backfilled without a request body by setting `BACKFILL_TOKEN` in the command environment and running `pnpm --filter @yangbok/worker data:backfill:local -- --from=YYYY-MM-DD --to=YYYY-MM-DD`. Before a remote deployment, create the D1 database, replace the placeholder `database_id` in `wrangler.jsonc`, apply migrations with `--remote`, configure the exact production origins, set `DATA_MODE=live`, and add both secrets with `wrangler secret put`.
