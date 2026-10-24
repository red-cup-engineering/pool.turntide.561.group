#!/usr/bin/env node
/**
 * pool.turntide.561.group's build step: renders every static page from `tidepool.json` (the one
 * parameter file) and the two Tidepool specifications, verifying every quoted rule is a real
 * substring of its cited specification before writing anything. No business logic of its own —
 * this file only reads, verifies, and templates; `pool-service` and the governance operations
 * own the actual pool. Run: `npm run build`.
 */
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deriveTipsPage } from "@red-cup-engineering/tips-services-section/derive-tips-page";
import { specQuote, verifyAllSpecQuotes } from "./src/spec-quotes.mjs";
import { validatePublicPoolProjection } from "./src/public-pool-projection.mjs";
import { pageShell, quoteBlock, emptyState, escapeHtml, renderTidepoolForm } from "./src/render.mjs";
import { SECTION_ROOT as TURNTIDE_ROOT, PARAMETERS_PATH, PUBLIC_PROJECTION_PATH } from "./src/section-root.mjs";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(ROOT, "dist");
const ORIGIN = "https://pool.turntide.561.group";
const PARTICIPANT_GOVERNANCE_PATH = path.join(TURNTIDE_ROOT, "data", "records", "governance", "tidepool-participant-governance.json");
const TIDEPOOL_STATUS_PATH = path.join(TURNTIDE_ROOT, "data", "records", "governance", "tidepool-civic-status.json");

// The specifications sit in this section's own content tree (tidepool-services-section), two levels up from the site.
const SPEC_DIR = path.join(TURNTIDE_ROOT, "content/text/documents/articles/specifications/2026/09/05");
const SPEC_FILES = Object.freeze({
  economics: path.join(SPEC_DIR, "2026-09-05-specification-of-the-directed-yield-pool-economics.md"),
  governance: path.join(SPEC_DIR, "2026-09-05-specification-of-the-directed-yield-pool-membership-and-governance.md"),
});

/** Reads one Markdown spec's body (frontmatter stripped) via the house reader. */
async function readSpecBody(specPath) {
  const raw = await readFile(specPath, "utf8");
  if (!raw.startsWith("---\n")) return raw;
  const fenceEnd = raw.indexOf("\n---\n", 4);
  return fenceEnd === -1 ? raw : raw.slice(fenceEnd + 5);
}

function renderSpecQuoteHtml(markdown) {
  const text = String(markdown).trim().replace(/\s*\n\s*/gu, " ");
  return `<p>${escapeHtml(text)}</p>`;
}

/** Renders one already-registered spec quote as a cited blockquote. */
function q(id, sourcesById) {
  const spec = specQuote(id);
  return quoteBlock(spec, renderSpecQuoteHtml(spec.quote), sourcesById[spec.source]);
}

function pct(fraction) {
  return `${Math.round(fraction * 1000) / 10}%`;
}

function homePage(params, sourcesById) {
  const body = `
    <section>
      <p>Tidepool is a directed-yield pool, affiliated with Turntide, run by Causeway Services. It is a business a member joins for what it does — the way anyone joins a credit union or a buyers' co-op.</p>
      ${q("receiver-and-offer", sourcesById)}
      ${q("small-is-all", sourcesById)}
      ${q("no-identity-test", sourcesById)}
    </section>
    <section>
      <h2>The credit-line side</h2>
      ${q("governance-receiver-and-offer", sourcesById)}
      <p><a href="/join/">See the admission paths &rarr;</a></p>
    </section>
    <section>
      <h2>Start here</h2>
      <ul>
        <li><a href="/how-it-works/">How it works</a> — the mechanism, the split, the law it stays inside.</li>
        <li><a href="/join/">Join</a> — the three admission paths and a request form.</li>
        <li><a href="/governance/">Governance</a> — how membership, enterprise admission, distribution voting, cycle close, and public receipts actually move.</li>
        <li><a href="/members/">Members &amp; enterprises</a> — who is on the roster today.</li>
        <li><a href="/cycles/">Cycles</a> — every cycle's split, once one has closed.</li>
        <li><a href="/position/">Your position</a> — read your own on-chain yield and route it, from your own wallet.</li>
        <li><a href="/support/">Support</a> — tip this work directly.</li>
        <li><a href="/risks/">Risks</a> — the falsifiers, stated plainly.</li>
      </ul>
    </section>`;
  return pageShell({ title: "What Tidepool is", description: "Tidepool: keep your principal, route the yield, vote the split. A directed-yield pool affiliated with Turntide, run by Causeway Services.", activeHref: "/", bodyHtml: body });
}

function howItWorksPage(params, sourcesById) {
  const { split } = params.pool;
  const body = `
    <section>
      <h2>What stays lawful in the United States</h2>
      ${q("constraint-no-token", sourcesById)}
      ${q("constraint-no-custody", sourcesById)}
      <p>Your principal never leaves your own wallet. Only the yield moves, and only once you have already signed for it.</p>
    </section>
    <section>
      <h2>The routing step</h2>
      ${q("routing-step", sourcesById)}
      <p>See <a href="/position/">your position</a> for the page that composes this transaction for you.</p>
    </section>
    <section>
      <h2>The split: ${pct(split.reserve)} / ${pct(split.float)} / ${pct(split.distributable)}</h2>
      <p>These figures are read from this site's own parameter file (<code>tidepool.json</code>'s <code>pool.split</code>), the same numbers the economic specification names as the pool's default:</p>
      ${q("split-reserve", sourcesById)}
      ${q("split-float", sourcesById)}
      ${q("split-distributable", sourcesById)}
      <p>Of the distributable bucket, ${pct(split.fixedShareOfDistributable)} splits evenly across every admitted member enterprise regardless of the vote; the rest splits by each member's matched-tally vote weight.</p>
      ${q("no-house-fee", sourcesById)}
    </section>
    <section>
      <h2>Who decides the vote</h2>
      ${q("voting-power-weighting", sourcesById)}
      ${q("quorum-rule", sourcesById)}
    </section>
    <section>
      <h2>A missed settlement</h2>
      ${q("default-held-not-punished", sourcesById)}
      ${q("default-never-removes", sourcesById)}
    </section>`;
  return pageShell({ title: "How it works", description: "The mechanism: US legal constraints, the routing step, the 20/30/50 split, the matched-tally vote, and how a missed settlement is held rather than punished.", activeHref: "/how-it-works/", bodyHtml: body });
}

function admissionRequestForm() {
  return renderTidepoolForm({
    id: "admission-form", action: "/api/admission-request", method: "post", enhance: false,
    fields: [
      { id: "account", name: "account", label: "Proposed account id", required: true, maxLength: 200 },
      { id: "chain", name: "chain", label: "Chain or rail", required: true, maxLength: 100, placeholder: "base, hive, ..." },
      { id: "contact", name: "contact", label: "Contact (email or other reachable address)", required: true, minLength: 3, maxLength: 320 },
      { id: "destination", name: "destination", label: "Settlement destination (optional until technical onboarding)", maxLength: 200, placeholder: "Base 0x… address or Hive account" },
      { id: "ledger-provider", name: "ledgerProvider", label: "Ledger witness provider (optional until technical onboarding)", maxLength: 200, placeholder: "the provider that can return your posting record" },
      { id: "ledger-subject", name: "ledgerSubject", label: "Ledger witness subject (optional until technical onboarding)", maxLength: 500, placeholder: "provider-specific member-controlled record locator" },
      { id: "ledger-record-ni", name: "ledgerRecordNi", label: "Ledger witness record NI (optional until technical onboarding)", maxLength: 200, placeholder: "ni:///sha-256;…" },
      { id: "sponsor-vouch", name: "kind", kind: "radio", label: "Admission path: sponsor vouch", value: "sponsor-vouch", checked: true, required: true },
      { id: "enterprise-roster", name: "kind", kind: "radio", label: "Admission path: enterprise roster", value: "enterprise-roster", required: true },
      { id: "turntide-islander-role", name: "kind", kind: "radio", label: "Admission path: Turntide Islander role", value: "turntide-islander-role", required: true },
      { id: "sponsor-account", name: "sponsorAccount", label: "Sponsor’s account", maxLength: 200 },
      { id: "pledged-amount", name: "pledgedAmount", label: "Pledged amount", maxLength: 100 },
      { id: "enterprise-id", name: "enterpriseId", label: "Enterprise id", maxLength: 200 },
      { id: "discord-subject-hash", name: "discordSubjectHash", label: "Discord subject hash", maxLength: 200 },
      { id: "guild-id", name: "guildId", label: "Guild id", maxLength: 100 },
      { id: "role-id", name: "roleId", label: "Role id", maxLength: 100 },
    ],
    submitters: [{ label: "Request admission" }],
  });
}

function joinPage(params, sourcesById) {
  const body = `
    <section>
      <h2>Three admission paths</h2>
      <p>An applicant supplies exactly one of these, per the membership and governance specification's <code>admissionWitness</code> kinds:</p>
      ${q("admission-sponsor-vouch", sourcesById)}
      ${q("admission-enterprise-roster", sourcesById)}
      ${q("admission-turntide-islander-role", sourcesById)}
    </section>
    <section>
      <h2>Exit</h2>
      ${q("exit-rules", sourcesById)}
    </section>
    <section>
      <h2>Request admission</h2>
      <p>The short path is still first-stage intake: contact, proposed pool account, expected rail, and an admission-path claim. If you already have the technical pieces, you may also provide the settlement destination plus all three fields of a member-controlled content-addressed ledger witness (provider, subject, and <code>ni:///sha-256;…</code> record digest). Leave all four technical fields blank if you do not have them yet; onboarding can establish them later. Tidepool never asks you for a server filesystem path.</p>
      <p>When those technical resources are present, the receiver can preserve them as a Membership v2 operation template for <code>pool-service</code>. Sponsor-vouch and enterprise-roster templates can then be verified against the pool’s own state; a Turntide Islander claim still requires the separate live role verifier before it can become an admission witness. A successful form submission always means <em>request recorded</em>, never <em>member admitted</em>.</p>
      ${admissionRequestForm()}
      <p id="admission-result" role="status" aria-live="polite"></p>
    </section>
    <script type="module" src="/js/admission-form.mjs"></script>`;
  return pageShell({ title: "Join", description: "The three admission paths (sponsor vouch, enterprise roster, Turntide Islander role), exit rules, and the admission request form.", activeHref: "/join/", bodyHtml: body });
}

function governancePage(guide, status) {
  const laneHtml = guide.lanes.map((lane) => {
    const transitions = Array.isArray(lane.authoritativeTransitions)
      ? lane.authoritativeTransitions
      : lane.authoritativeTransition === undefined ? [] : [lane.authoritativeTransition];
    const states = (lane.states ?? []).map((state) =>
      `<li><strong>${escapeHtml(state.id)}</strong> — ${escapeHtml(state.meaning)}</li>`).join("\n");
    const participant = (lane.participantMay ?? []).map((move) => `<li>${escapeHtml(move)}</li>`).join("\n");
    const details = [
      lane.voteRule === undefined ? "" : `<p><strong>Vote rule:</strong> ${escapeHtml(lane.voteRule)}</p>`,
      lane.votingPower === undefined ? "" : `<p><strong>Voting power:</strong> ${escapeHtml(lane.votingPower)}</p>`,
      lane.quorumRule === undefined ? "" : `<p><strong>Quorum:</strong> ${escapeHtml(lane.quorumRule)}</p>`,
      lane.splitRule === undefined ? "" : `<p><strong>Split:</strong> ${escapeHtml(lane.splitRule)}</p>`,
      lane.receivingRule === undefined ? "" : `<p><strong>Receiving:</strong> ${escapeHtml(lane.receivingRule)}</p>`,
      lane.appendOnlyRule === undefined ? "" : `<p><strong>Append-only rule:</strong> ${escapeHtml(lane.appendOnlyRule)}</p>`,
    ].join("");
    return `<article id="${escapeHtml(lane.id)}">
      <h2>${escapeHtml(lane.title)}</h2>
      <p><strong>${escapeHtml(lane.participantQuestion)}</strong></p>
      <h3>What a participant can do</h3>
      <ul>${participant}</ul>
      ${states ? `<h3>States</h3><ul>${states}</ul>` : ""}
      ${transitions.length ? `<p><strong>Authoritative operation(s):</strong> ${transitions.map((value) => `<code>${escapeHtml(value)}</code>`).join(", ")}</p>` : ""}
      ${details}
      <p><strong>Authority boundary:</strong> ${escapeHtml(lane.authorityBoundary)}</p>
      <p><strong>Zelo:</strong> ${escapeHtml(lane.zeloRole)}</p>
    </article>`;
  }).join("\n");

  const body = `
    <section>
      <h2>Current operating condition</h2>
      <p>This is a dated receiving-side observation, not a promise that source code is live. As of <strong>${escapeHtml(status.observedAt)}</strong>, the Tidepool runtime is <strong>${escapeHtml(status.runtime.operationState)}</strong>, the protocol-clerk seat is <strong>${escapeHtml(status.executor.incumbentState)}</strong>, and the first admission → vote → cycle → disclosure loop is <strong>${escapeHtml(status.firstOperatingLoop.state)}</strong>.</p>
      <p><strong>Current blocker:</strong> ${escapeHtml(status.firstOperatingLoop.currentBlocker)}</p>
      <p>The nine protocol operations may exist while remaining unavailable to ordinary Turntide/Board offices. Operation availability is execution capability, not permission to invent a member, vote, weight, yield receipt, witness, or settlement.</p>
    </section>
    <section>
      <h2>Five governance lanes</h2>
      <p>Tidepool financial governance is separate from Turntide-wide DAO standing. Joining Discord or holding Turntide standing does not grant Tidepool membership or financial authority.</p>
      ${laneHtml}
    </section>
    <section>
      <h2>Who executes authorized transitions?</h2>
      <p><strong>${escapeHtml(guide.currentExecutionBoundary.executorOffice)}</strong> exists to ${escapeHtml(guide.currentExecutionBoundary.executorPurpose)} It does not acquire decision authority from being able to execute an operation.</p>
    </section>`;
  return pageShell({
    title: "Governance",
    description: "Tidepool participant governance: member admission, enterprise admission, distribution voting, cycle close and public disclosure, with current operating-state boundaries.",
    activeHref: "/governance/",
    bodyHtml: body,
  });
}

function projectionReceipt(disclosure) {
  return disclosure === null
    ? ""
    : `<p class="muted">Received from <code>${escapeHtml(disclosure.source.producer)}</code> / <code>${escapeHtml(disclosure.source.operation)}</code>; operation receipt <code>${escapeHtml(disclosure.source.operationReceipt)}</code>; disclosure NI <code>${escapeHtml(disclosure.source.recordNi)}</code>; source <code>${escapeHtml(disclosure.source.recordRef)}</code>.</p>`;
}

function membersPage(projection, sourcesById) {
  const latest=projection.disclosures.at(-1) ?? null;
  const rosterHtml = latest === null
    ? emptyState("No pool-service public roster disclosure has been received by this site yet. That is a statement about this projection boundary, not evidence that no enterprise has been admitted.")
    : latest.public.roster.length === 0
      ? emptyState("The latest received pool-service public disclosure contains an empty admitted-enterprise roster.")
      : `<ul>${latest.public.roster.map((e) => `<li><strong>${escapeHtml(e.enterpriseId)}</strong> — ${escapeHtml(e.offer)}</li>`).join("\n")}</ul>`;
  const body = `
    <section>
      <h2>Member enterprises</h2>
      ${q("member-enterprise-definition", sourcesById)}
      ${rosterHtml}
      ${projectionReceipt(latest)}
    </section>
    <section>
      <h2>What the public sees</h2>
      ${q("disclosure-public-sees", sourcesById)}
      <p>An enterprise not yet on the latest received public roster can apply through the same admission-vote process described in the <a href="/how-it-works/">governance rule</a>. Admission authority remains with pool-service/governance; this site only projects received public disclosures.</p>
    </section>`;
  return pageShell({ title: "Members & enterprises", description: "The latest public member-enterprise roster received from pool-service, with source receipt provenance and an explicit unreceived state.", activeHref: "/members/", bodyHtml: body });
}

function cyclesPage(projection, sourcesById) {
  const cyclesHtml = projection.disclosures.length === 0
    ? emptyState("No pool-service public cycle disclosure has been received by this site yet. That is a statement about this projection boundary, not evidence that no cycle has closed.")
    : projection.disclosures.map((disclosure) => {
      const c=disclosure.public.cycle;
      const allocations=c.perEnterpriseTotals.map((a)=>`${escapeHtml(a.enterpriseId)} ${escapeHtml(a.total)} ${escapeHtml(c.commodity)}`).join(", ");
      return `<article>
        <h3>${escapeHtml(c.cycleId)}</h3>
        <p>Published ${escapeHtml(disclosure.source.cyclePublishedAt)}. Total directed yield: <strong>${escapeHtml(c.totalYield)} ${escapeHtml(c.commodity)}</strong>.</p>
        <dl>
          <dt>Barrier reserve</dt><dd>${escapeHtml(c.reserve)} ${escapeHtml(c.commodity)} (${escapeHtml(c.splitRatioPercent.reserve)}%)</dd>
          <dt>Tally-credit float</dt><dd>${escapeHtml(c.float)} ${escapeHtml(c.commodity)} (${escapeHtml(c.splitRatioPercent.float)}%)</dd>
          <dt>Distributable</dt><dd>${escapeHtml(c.distributable)} ${escapeHtml(c.commodity)} (${escapeHtml(c.splitRatioPercent.distributable)}%)</dd>
          <dt>Fixed portion of distributable</dt><dd>${escapeHtml(c.fixedPortion)} ${escapeHtml(c.commodity)}</dd>
          <dt>Voted portion of distributable</dt><dd>${escapeHtml(c.votedPortion)} ${escapeHtml(c.commodity)}</dd>
          <dt>Vote close</dt><dd>${c.quorumMet ? "Quorum met" : "Below quorum"} — ${escapeHtml(c.voteMode === "weighted" ? "weighted allocation" : "equal-allocation fallback")}</dd>
          <dt>Per-enterprise totals</dt><dd>${allocations || "none"}</dd>
        </dl>
        ${projectionReceipt(disclosure)}
      </article>`;
    }).join("\n");
  const body = `
    <section>
      <h2>Cycle history</h2>
      ${cyclesHtml}
    </section>
    <section>
      <h2>Publication cadence</h2>
      ${q("disclosure-cadence", sourcesById)}
    </section>`;
  return pageShell({ title: "Cycles", description: "Append-only exact-decimal public cycle disclosures received from pool-service: reserve, float, distributable, fixed/voted sub-split, allocations, and source receipts.", activeHref: "/cycles/", bodyHtml: body });
}

function positionPage(params, sourcesById) {
  const routingDisabled = params.pool.baseAddress === null || params.pool.vaults.length === 0;
  const disabledNotice = routingDisabled
    ? emptyState(`Routing is disabled: ${params.pool.baseAddress === null ? "the pool has no receiving Base address recorded yet" : "no standing vault is recorded yet"} in tidepool.json. ${specQuote("founders-hands-vs-machine-work").quote}`)
    : "";
  const body = `
    <section>
      <h2>Connect your wallet</h2>
      <p>This page reads your own Base wallet through your browser's own EIP-1193 provider (<code>window.ethereum</code>). It never asks for a key, and it never relays a transaction on your behalf — your wallet signs and broadcasts everything itself.</p>
      <button id="connect-wallet" type="button">Connect wallet</button>
      <p id="wallet-status" role="status" aria-live="polite">Not connected.</p>
    </section>
    <section>
      <h2>Your principal (your own note)</h2>
      <p>Tidepool holds no record of your principal. Enter the USDC amount you originally intend to preserve so this page can compare it with the vault's fee-aware redeemable value; it is saved only in your own browser's local storage, never sent anywhere.</p>
      <label>My recorded principal (USDC)
        <input type="text" id="principal-input" placeholder="0.00" inputmode="decimal" />
      </label>
      <button id="save-principal" type="button">Save</button>
    </section>
    <section>
      <h2>Your position</h2>
      <dl id="position-readout">
        <dt>Vault shares</dt><dd id="readout-shares">—</dd>
        <dt>Redeemable value in USDC (previewRedeem)</dt><dd id="readout-assets">—</dd>
        <dt>USDC wallet balance</dt><dd id="readout-usdc">—</dd>
        <dt>Accrued yield (redeemable USDC above your recorded principal)</dt><dd id="readout-accrued">—</dd>
      </dl>
    </section>
    <section>
      <h2>Route this cycle's yield</h2>
      ${q("routing-step", sourcesById)}
      ${disabledNotice}
      <button id="route-yield" type="button"${routingDisabled ? " disabled" : ""}>Route this cycle's yield</button>
      <p id="route-status" role="status" aria-live="polite"></p>
    </section>
    <script id="tidepool-position-config" type="application/json">${JSON.stringify({ chainId: params.pool.chainId, usdc: params.pool.usdc, vaults: params.pool.vaults, poolAddress: params.pool.baseAddress })}</script>
    <script type="module" src="/js/position-client.mjs"></script>`;
  return pageShell({ title: "Your position", description: "Read your own Base wallet's fee-aware redeemable vault value and compose one member-signed ERC-4626 redeem that routes conservatively derived yield shares directly to the pool receiver.", activeHref: "/position/", bodyHtml: body });
}

async function supportPage() {
  // Rendered entirely from a fresh deriveTipsPage() call, never from tidepool.json's committed
  // params.tips snapshot (2026-09-05 ruling, payment-receivers-are-parameters-never-literals):
  // a stale committed snapshot is exactly how an uncustodied wallet could keep reaching this
  // page even after the live registry stopped verifying it. deriveTipsPage() already omits any
  // endpoint whose walletId has no custody entry verified "agreed".
  const page = await deriveTipsPage();
  const tipsFragment = "<p>" + escapeHtml(page.markdown).replace(/\s*\n\s*/gu, " ") + "</p>";
  const rows = page.endpoints.map((e) => `<li><strong>${escapeHtml(e.provider)}</strong> (${escapeHtml(e.state)}) — <span class="muted">books to ${escapeHtml(e.bookingAccount)}</span></li>`).join("\n");
  const body = `
    <section>
      ${tipsFragment}
      <ul>${rows}</ul>
    </section>`;
  return pageShell({ title: "Support", description: "Tip this work directly, through whichever endpoint tips-services-section's own record lists as live or code-ready.", activeHref: "/support/", bodyHtml: body });
}

function risksPage(sourcesById) {
  const body = `
    <section>
      <h2>Falsifiers named by the economic specification</h2>
      ${q("falsifier-yield-below-cost", sourcesById)}
      ${q("falsifier-legal-reading", sourcesById)}
      ${q("falsifier-member-churn", sourcesById)}
    </section>
    <section>
      <h2>Falsifiers named by the membership and governance specification</h2>
      ${q("falsifier-participation", sourcesById)}
      ${q("falsifier-default-rate", sourcesById)}
      ${q("falsifier-capture", sourcesById)}
      ${q("falsifier-admission-path-capture", sourcesById)}
    </section>
    <section>
      <h2>Status</h2>
      <p>Both specifications are marked <strong>draft-for-owner-review</strong>. The economic specification names five open legal and technical questions (tax treatment, accounting sign-off, cross-chain float usability, a dedicated pool address, and rate-reading automation) not yet resolved. ${q("org-form-recommendation", sourcesById)}</p>
    </section>`;
  return pageShell({ title: "Risks", description: "Every falsifier both Tidepool specifications name, quoted verbatim, and the specifications' current draft status.", activeHref: "/risks/", bodyHtml: body });
}

function sourcesPage(params) {
  const items = params.sources.map((s) => `
    <article id="${escapeHtml(s.id)}">
      <h2>${escapeHtml(s.title)}</h2>
      <p>${escapeHtml(s.date)} — <span class="muted">${escapeHtml(s.status)}</span></p>
      <p class="muted">${escapeHtml(s.citation)}</p>
    </article>`).join("\n");
  const body = `
    <section>
      <p>The economic/legal rules quoted by this site are whitespace-normalized-verbatim from these specification carriers. Participant-governance wayfinding and dated operating-state claims come instead from explicit Turntide/Tidepool governance records and are labeled as such. Neither specification has a public URL yet (both are internal drafts under owner review); each quoted rule's link on this site returns here rather than to a hosted copy.</p>
      ${items}
    </section>`;
  return pageShell({ title: "Sources", description: "The specifications every rule on this site quotes from, by title, date, and status.", activeHref: "/sources/", bodyHtml: body });
}

async function writePage(relDir, html) {
  const dir = path.join(DIST, relDir);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "index.html"), html);
}

/** Runs the whole build: verifies quotes, renders every page, writes `dist/`. */
async function build() {
  const params = JSON.parse(await readFile(PARAMETERS_PATH, "utf8"));
  const publicProjection = JSON.parse(await readFile(PUBLIC_PROJECTION_PATH, "utf8"));
  const participantGovernance = JSON.parse(await readFile(PARTICIPANT_GOVERNANCE_PATH, "utf8"));
  const tidepoolStatus = JSON.parse(await readFile(TIDEPOOL_STATUS_PATH, "utf8"));
  const projectionValidation = validatePublicPoolProjection(publicProjection);
  if (!projectionValidation.valid) throw new Error(`public-pool-projection failed schema validation: ${JSON.stringify(projectionValidation.errors)}`);
  const bodiesBySource = { economics: await readSpecBody(SPEC_FILES.economics), governance: await readSpecBody(SPEC_FILES.governance) };
  verifyAllSpecQuotes(bodiesBySource);
  const sourcesById = Object.fromEntries(params.sources.map((s) => [s.id, s]));

  await mkdir(DIST, { recursive: true });
  await writeFile(path.join(DIST, "index.html"), homePage(params, sourcesById));
  await writePage("how-it-works", howItWorksPage(params, sourcesById));
  await writePage("join", joinPage(params, sourcesById));
  await writePage("governance", governancePage(participantGovernance, tidepoolStatus));
  await writePage("members", membersPage(publicProjection, sourcesById));
  await writePage("cycles", cyclesPage(publicProjection, sourcesById));
  await writePage("position", positionPage(params, sourcesById));
  await writePage("support", await supportPage());
  await writePage("risks", risksPage(sourcesById));
  await writePage("sources", sourcesPage(params));

  await mkdir(path.join(DIST, "js"), { recursive: true });
  await copyFile(path.join(ROOT, "src", "position-transactions.mjs"), path.join(DIST, "js", "position-transactions.mjs"));
  await copyFile(path.join(ROOT, "assets", "position-client.mjs"), path.join(DIST, "js", "position-client.mjs"));
  await copyFile(path.join(ROOT, "assets", "admission-form.mjs"), path.join(DIST, "js", "admission-form.mjs"));

  const pages = ["/", ...["how-it-works", "join", "governance", "members", "cycles", "position", "support", "risks", "sources"].map((slug) => `/${slug}/`)];
  await writeFile(path.join(DIST, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${ORIGIN}/sitemap.xml\n`);
  await writeFile(path.join(DIST, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map((page) => `  <url><loc>${ORIGIN}${page}</loc></url>`).join("\n")}\n</urlset>\n`);
  await writeFile(path.join(DIST, "404.html"), pageShell({ title: "Not found", description: "Page not found.", activeHref: "", bodyHtml: "<section><p>That page does not exist. <a href=\"/\">Back to Tidepool</a>.</p></section>" }));

  process.stdout.write(`build.mjs: wrote 10 pages and 3 static scripts to ${DIST}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await build();
}

export { build, cyclesPage, governancePage };
