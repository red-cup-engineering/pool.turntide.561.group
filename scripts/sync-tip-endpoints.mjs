#!/usr/bin/env node
/**
 * Refreshes tidepool.json's `tips` field from tips-services-section's own `deriveTipsPage`
 * (2026-09-05 ruling, payment-receivers-are-parameters-never-literals) -- never a literal
 * receiver: every wallet-backed endpoint is resolved and custody-verified there, and any
 * endpoint whose wallet has no custody entry verified `"agreed"` is already omitted from what
 * this script reads, so a wallet the Group holds no verified key for can never reach this site.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { deriveTipsPage } from "@red-cup-engineering/tips-services-section/derive-tips-page";
import { loadEndpoints } from "@red-cup-engineering/tips-services-section";
import { runJavascriptNodeOperation } from "@red-cup-engineering/javascript-node-services-section/operation";
import { PARAMETERS_PATH } from "../src/section-root.mjs";

const PARAMS_PATH = PARAMETERS_PATH;

function instructionsFor(endpoint) {
  if (endpoint.rail === "hive") return `Send a${endpoint.provider.includes("HBD") ? "n HBD" : " HIVE"} transfer to @${endpoint.receiver} on the Hive blockchain. Any memo is welcome but not required.`;
  if (endpoint.rail === "base-usdc") return `Send USDC on Base to ${endpoint.receiver}.`;
  if (endpoint.state === "code-ready") return `${endpoint.provider} is code-ready but not yet armed with live credentials; not shown as a working option until it is.`;
  return `See ${endpoint.provider} for how to send.`;
}

/**
 * Reads tips-services-section's resolved, custody-verified endpoint list and writes it into
 * this site's own `tidepool.json` parameter file.
 * @returns {Promise<{recordedAt: string, sourceRecord: string, endpoints: object[], refusals: object[]}>}
 */
export async function syncTipEndpoints() {
  const page = await deriveTipsPage();
  const endpoints = page.endpoints.map((endpoint) => ({
    id: endpoint.id, rail: endpoint.rail, provider: endpoint.provider, receiver: endpoint.receiver,
    state: endpoint.state, instructions: instructionsFor(endpoint), bookingAccount: endpoint.bookingAccount,
  }));
  const params = JSON.parse(readFileSync(PARAMS_PATH, "utf8"));
  params.tips = {
    recordedAt: loadEndpoints().recordedAt,
    sourceRecord: "tips-services-section/data/records/2026-09-05-tip-endpoints.json",
    endpoints,
    // A refusal names a wallet the Group holds no verified key for; the published page needs only that one was
    // refused, never which wallet (a wallet id names its holder).
    refusals: page.refusals.map(({ refused, rail }) => ({ refused, rail })),
  };
  writeFileSync(PARAMS_PATH, `${JSON.stringify(params, null, 2)}\n`);
  return params.tips;
}

if (import.meta.main) {
  const result = await runJavascriptNodeOperation({ name: "sync-tip-endpoints", description: "Reads tips-services-section's resolved, custody-verified endpoint list and writes it into this site's own `tidepool.json` parameter file.", operation: syncTipEndpoints }, { arguments: process.argv.slice(2), standardInput: process.stdin, standardOutput: process.stdout });
  process.exitCode = result.exitCode;
}
