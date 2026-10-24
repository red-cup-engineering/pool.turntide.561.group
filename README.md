Received 2026-10-24 from causeway-services/pool.turntide.561.group@b64b94d8026e56db9a827cfaa8d64e3afa1b8154

# pool.turntide.561.group

<!-- 561-group-standards:badges:start -->
[![Causeway Services](https://img.shields.io/badge/561%20Group-Causeway%20Services-115e69)](https://github.com/causeway-services)
[![License: Apache 2.0](https://img.shields.io/badge/license-Apache%202.0-115e69)](LICENSE)
[![Indigenous data: CARE](https://img.shields.io/badge/Indigenous%20data-CARE-4b6f44)](https://github.com/causeway-services/.github/blob/main/GOVERNANCE.md)
[![Tips welcome](https://img.shields.io/badge/tips-welcome-d4a017)](https://github.com/561-group/.github/blob/main/TIPS.md)
<!-- 561-group-standards:badges:end -->

The public web face of Tidepool, the Turntide directed-yield pool. Run by
Causeway Services.

## Parameters live in the section

Since 2026-10-24 this repository holds only the application (build, Worker, client scripts, tests). The data that parameterizes it is Public data and lives in [causeway-services/public-tidepool-services-section](https://github.com/causeway-services/public-tidepool-services-section): `tidepool.json`, `data/records/public-pool-projection.json`, `data/records/schema/*.schema.json`, the parameter snapshot and the witness logs, together with the specifications and governance records the build already read from there.

The build, the scripts and the tests find the section through `src/section-root.mjs`: `TIDEPOOL_SECTION_ROOT=/path/to/public-tidepool-services-section`, or, unset, `../..` (this repository mounted at `<section>/sites/pool.turntide.561.group`, the monorepo layout). Everywhere below, `tidepool.json` and `data/records/...` mean those files in the section.

```sh
git clone https://github.com/causeway-services/public-tidepool-services-section.git section
TIDEPOOL_SECTION_ROOT=$PWD/section npm run build
```

## What this site is

A public projection, not a bespoke pool daemon: `tidepool.json` holds static
product/pool parameters, while `data/records/public-pool-projection.json`
holds an append-only receipt-bound public projection imported from pool-service's
`publish-cycle-disclosure` operation. `build.mjs` renders static HTML from
those records plus the two Tidepool specifications, and `worker.mjs` serves
the built assets plus admission-request intake. Every rule this site states is
a whitespace-normalized verbatim quote from one of the two specifications
(`src/spec-quotes.mjs`, verified against live specification text on every
build). An unreceived projection is stated as unreceived; the site never turns
absence of a received roster/cycle disclosure into a claim that the underlying
pool has none.

## Layout

- `tidepool.json` — static product/pool parameters only (schema at
  `data/records/schema/tidepool-parameters.schema.json`). It is not allowed
  to carry roster or cycle authority.
- `data/records/public-pool-projection.json` — the website's append-only received
  public disclosure history from pool-service. It begins in `unreceived` state.
  `scripts/import-pool-disclosure.mjs` accepts a PoolCycleDisclosure plus its
  operation receipt/provenance, independently content-addresses the disclosure bytes, strips the members-only view, and appends only the
  disclosure's public roster/cycle/falsifiers. Re-importing the same cycle and
  disclosure NI is idempotent; the same cycle with different disclosure bytes is refused for
  reconciliation upstream. Exact decimal strings remain strings; the website
  never re-computes financial amounts.
- `scripts/sync-tip-endpoints.mjs` — refreshes `tidepool.json`'s `tips` field
  from `@red-cup-engineering/tips-engineering-services-section`'s own live/code-ready
  endpoints. Never hand-edit that field.
- `src/spec-quotes.mjs` — every quoted rule plus the verification that proves
  each is a real substring of its cited specification.
- `src/render.mjs` — pure HTML template functions (page shell, quote blocks,
  empty-state notices). No I/O.
- `src/position-transactions.mjs` — pure EVM calldata composition and
  asset-denominated yield accounting for the "your position" page. It reads
  ERC-20-style vault-share `balanceOf`, ERC-4626 conversion/preview methods,
  and composes one `redeem` with the member as owner and the pool as receiver.
  No `node:` import, so this exact file also ships to the browser
  (`dist/js/position-transactions.mjs`) and runs there unmodified.
- `assets/position-client.mjs`, `assets/admission-form.mjs` — hand-written
  browser client scripts (wallet connection via `window.ethereum`/EIP-1193
  only, and the admission-request form), copied verbatim into `dist/js/` at
  build time.
- `build.mjs` — the build step: reads `tidepool.json` and the two
  specifications, verifies every quote, renders nine pages plus CSS and the
  three client scripts into `dist/`.
- `worker.mjs` — serves `dist/` as static assets and handles
  `POST /api/admission-request` (validated against
  `data/records/schema/admission-request.schema.json` via
  `@red-cup-engineering/validate-json-service`, stored as a dated KV record
  under the `ADMISSION_REQUESTS` binding). A short submission remains
  stage-one `intake`. When the applicant also supplies a typed settlement
  destination and a member-controlled `content-addressed-postings` witness,
  the same receiver preserves an `operation-template-ready` record for
  sponsor/enterprise admission paths. Turntide-role claims remain
  `awaiting-role-verification` until the separate live verifier produces its
  witness. The receiver does not invent a server-local ledger path and does
  not admit anyone; an authorized process reads the private KV record, stamps
  `admittedAt`, verifies the admission path against pool state, and calls
  authoritative `pool-service`. `GET /api/admission-requests` is deliberately
  not exposed.

## Commands

```sh
npm install
npm run check
npm test
npm run sync-tips   # refresh tidepool.json's tips field from tips-services-section
npm run import-pool-disclosure -- --record PATH --operation-receipt NI --record-ref REF
npm run build
npm run deploy      # build then wrangler deploy
```

## The wallet page never holds a key

`/position/` reads the member's own wallet through `window.ethereum`
(EIP-1193) directly — no third-party wallet SDK, no custodial anything. The
member records principal locally in USDC units. The page reads the vault's
fee-aware `previewRedeem` value, treats only value above that principal as
yield, and converts that asset amount to a conservative share count with
`convertToShares` (which ERC-4626 requires to round down).

Routing is one atomic member-signed ERC-4626 `redeem`: the member's wallet
remains the share `owner`, while Tidepool's pool address is the redeem
`receiver`. The vault therefore sends the resulting underlying USDC directly
to Tidepool in the same transaction. The browser never composes a separate
ERC-20 transfer from the member wallet, so unrelated/pre-existing wallet USDC
is outside the routing path. The page waits for a successful transaction
receipt before reporting confirmation; the pre-sign `previewRedeem` amount
is only an estimate, while pool-service reconciliation owns the booked
on-chain receipt amount. A legacy share-count principal note is never silently
reinterpreted as USDC; the member is told to re-enter principal. A non-null
pool address only makes the client path renderable from source parameters; it
is not by itself a deployment, authorization, or public-availability receipt.

## Domain migration note

Deploy this Worker with the `pool.turntide.561.group` custom domain configured
in `wrangler.jsonc`.
