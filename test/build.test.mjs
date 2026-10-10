import assert from "node:assert/strict";
import { readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { deriveTipsPage } from "@red-cup-engineering/tips-services-section/derive-tips-page";
import { build, cyclesPage } from "../build.mjs";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIST = path.join(ROOT, "dist");
const PAGES = ["", "how-it-works", "join", "governance", "members", "cycles", "position", "support", "risks", "sources"];

test("build() renders every page from the parameter file, verified against a fresh build", async () => {
  await rm(DIST, { recursive: true, force: true });
  await build();
  for (const page of PAGES) {
    const filePath = path.join(DIST, page, "index.html");
    const stats = await stat(filePath);
    assert.ok(stats.isFile(), `expected ${filePath} to exist`);
    const html = await readFile(filePath, "utf8");
    assert.match(html, /<title>.+— Tidepool<\/title>/u);
    assert.match(html, /Tidepool.*specification/u);
  }
});

test("the home page states the product name and affiliation from tidepool.json, not a hardcoded string", async () => {
  const params = JSON.parse(await readFile(path.join(ROOT, "tidepool.json"), "utf8"));
  const html = await readFile(path.join(DIST, "index.html"), "utf8");
  assert.match(html, new RegExp(params.product.name, "u"));
  assert.match(html, new RegExp(params.product.affiliation, "u"));
});

test("member and cycle pages fail closed when no pool-service public disclosure has been received", async () => {
  const projection = JSON.parse(await readFile(path.join(ROOT, "data", "records", "public-pool-projection.json"), "utf8"));
  assert.equal(projection.state, "unreceived");
  assert.deepEqual(projection.disclosures, []);
  const cycles = await readFile(path.join(DIST, "cycles", "index.html"), "utf8");
  const members = await readFile(path.join(DIST, "members", "index.html"), "utf8");
  assert.match(cycles, /No pool-service public cycle disclosure has been received/u);
  assert.match(cycles, /not evidence that no cycle has closed/u);
  assert.match(members, /No pool-service public roster disclosure has been received/u);
  assert.match(members, /not evidence that no enterprise has been admitted/u);
});

test("the position page follows pool.baseAddress: disabled with the reason when null, enabled with the address when set", async () => {
  const params = JSON.parse(await readFile(path.join(ROOT, "tidepool.json"), "utf8"));
  const html = await readFile(path.join(DIST, "position", "index.html"), "utf8");
  if (params.pool.baseAddress === null) {
    assert.match(html, /id="route-yield" type="button" disabled/u);
    assert.match(html, /Routing is disabled/u);
  } else {
    assert.doesNotMatch(html, /id="route-yield" type="button" disabled/u);
    assert.match(html, new RegExp(params.pool.baseAddress, "u"));
  }
});

test("the position page records principal in USDC and exposes fee-aware redeemable value", async () => {
  const html = await readFile(path.join(DIST, "position", "index.html"), "utf8");
  assert.match(html, /My recorded principal \(USDC\)/u);
  assert.match(html, /Redeemable value in USDC \(previewRedeem\)/u);
  assert.match(html, /redeemable USDC above your recorded principal/u);
  assert.doesNotMatch(html, /principal \(vault shares\)/u);
  assert.match(html, /one member-signed ERC-4626 redeem/u);
  assert.doesNotMatch(html, /two transactions/u);
});

test("the position client fails closed on absent blank malformed or zero principal", async () => {
  const source = await readFile(path.join(ROOT, "assets", "position-client.mjs"), "utf8");
  assert.match(source, /stored === null \|\| stored\.trim\(\) === ""/u);
  assert.match(source, /principal > 0n \? principal : null/u);
  assert.doesNotMatch(source, /localStorage\.getItem\(PRINCIPAL_KEY\) \|\| "0"/u);
  assert.match(source, /Principal must be greater than zero USDC\./u);
  assert.match(source, /Record principal in USDC before Tidepool can calculate or route yield\./u);
});

test("the support page lists exactly the providers deriveTipsPage resolves live, never a stale tidepool.json snapshot", async () => {
  const html = await readFile(path.join(DIST, "support", "index.html"), "utf8");
  const page = await deriveTipsPage();
  for (const endpoint of page.endpoints) {
    assert.match(html, new RegExp(endpoint.provider.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
  }
  // Regression guard for the 2026-09-05 payment-receivers-are-parameters-never-literals ruling:
  // a wallet with no verified custody (here, the Hive account the Group holds only a vote key
  // for) must never appear on the rendered page, no matter what tidepool.json's committed
  // params.tips snapshot happens to say.
  for (const refusal of page.refusals) {
    const address = refusal.walletId.slice(refusal.walletId.indexOf(":") + 1);
    assert.doesNotMatch(html, new RegExp(address.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
  }
});

test("the admission request uses TUFTE’s native form model with constraints and a public action", async () => {
  const html = await readFile(path.join(DIST, "join", "index.html"), "utf8");
  assert.match(html, /<form id="admission-form"(?=[^>]*data-tufte-action="\/api\/admission-request")(?=[^>]*action="\/api\/admission-request")(?=[^>]*data-tufte-enhance="false")(?=[^>]*method="post")[^>]*>/u);
  assert.match(html, /name="account" required maxlength="200"/u);
  assert.match(html, /name="kind" required/u);
  assert.match(html, /first-stage intake/u);
  assert.match(html, /member-controlled content-addressed ledger witness/u);
  assert.match(html, /name="destination"/u);
  assert.match(html, /name="ledgerProvider"/u);
  assert.match(html, /name="ledgerSubject"/u);
  assert.match(html, /name="ledgerRecordNi"/u);
  assert.match(html, /never <em>member admitted<\/em>/u);
  assert.match(html, /live role verifier/u);
  assert.match(html, /never asks you for a server filesystem path/u);
});


test("cycles page renders authoritative quorum/fallback state from received disclosure", async () => {
  const params = JSON.parse(await readFile(path.join(ROOT, "tidepool.json"), "utf8"));
  const sourcesById = Object.fromEntries(params.sources.map((source) => [source.id, source]));
  const projection = {
    $schema: "./schema/public-pool-projection.schema.json",
    type: "TidepoolPublicProjection",
    state: "received",
    disclosures: [{
      source: {
        producer: "@red-cup-engineering/pool-service",
        operation: "publish-cycle-disclosure",
        operationReceipt: "ni:///sha-256;op",
        recordNi: "ni:///sha-256;record",
        recordRef: "fixture",
        importedAt: "2026-10-02T20:01:00Z",
        cyclePublishedAt: "2026-10-02T20:00:00Z",
      },
      public: {
        roster: [{ enterpriseId: "ent-a", offer: "repair things" }],
        cycle: {
          cycleId: "cycle-1",
          commodity: "USDC",
          totalYield: "10",
          reserve: "2",
          float: "3",
          distributable: "5",
          fixedPortion: "2.5",
          votedPortion: "2.5",
          quorumMet: false,
          voteMode: "equal-fallback",
          splitRatioPercent: { reserve: 20, float: 30, distributable: 50 },
          perEnterpriseTotals: [{ enterpriseId: "ent-a", total: "5" }],
        },
        falsifiers: ["fixture falsifier"],
      },
    }],
  };
  const html = cyclesPage(projection, sourcesById);
  assert.match(html, /Below quorum/u);
  assert.match(html, /equal-allocation fallback/u);
});


test("governance page exposes the five participant lanes and the dated execution boundary", async () => {
  const html = await readFile(path.join(DIST, "governance", "index.html"), "utf8");
  for (const lane of ["member-admission", "enterprise-admission", "distribution-vote", "cycle-close", "public-disclosure"]) {
    assert.match(html, new RegExp(`id="${lane}"`, "u"));
  }
  assert.match(html, /Current operating condition/u);
  assert.match(html, /protocol-clerk seat/u);
  assert.match(html, /first admission → vote → cycle → disclosure loop/u);
  assert.match(html, /Joining Discord or holding Turntide standing does not grant Tidepool membership or financial authority/u);
  assert.match(html, /admit-pool-member/u);
  assert.match(html, /record-distribution-vote/u);
  assert.match(html, /publish-cycle-disclosure/u);
});

test("sources page distinguishes quoted specifications from participant-governance records", async () => {
  const html = await readFile(path.join(DIST, "sources", "index.html"), "utf8");
  assert.match(html, /economic\/legal rules quoted by this site/u);
  assert.match(html, /Participant-governance wayfinding and dated operating-state claims/u);
});
