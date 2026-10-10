/**
 * The site's own claim on every rule it states: each entry names the exact sentence(s) taken
 * from one of the two Tidepool specifications (economic or governance), the page that quotes
 * it, and an anchor into the site's own /sources/ citation page. `verifySpecQuote` proves the
 * quote is a real substring of the cited specification's current text, so a spec edit that
 * drops a quoted rule fails the build rather than drifting silently.
 */

/**
 * Normalizes Markdown prose for verbatim-substring comparison: strips leading list-item
 * markers, `**bold**`/`*italic*` emphasis delimiters, and collapses all whitespace (including
 * line wraps inside a paragraph) to single spaces. A quote copied as plain prose from a bold
 * list item or a line-wrapped paragraph still matches its source by substring.
 * @param {string} text
 * @returns {string}
 */
export function normalizeWhitespace(text) {
  if (typeof text !== "string") throw new TypeError("normalizeWhitespace: text must be a string");
  return text
    .replace(/^ {0,3}(?:[-*+]|\d+[.)])\s+/gmu, "")
    .replace(/\*\*([^*]+)\*\*/gu, "$1")
    .replace(/(?<![A-Za-z0-9])\*([^*]+)\*(?![A-Za-z0-9])/gu, "$1")
    .replace(/\s+/gu, " ")
    .trim();
}

/**
 * @typedef {object} SpecQuote
 * @property {string} id
 * @property {"economics"|"governance"} source
 * @property {string} quote
 */

/** @type {SpecQuote[]} */
export const SPEC_QUOTES = Object.freeze([
  {
    id: "receiver-and-offer",
    source: "economics",
    quote: "Tidepool's receiver is a member with a little money sitting somewhere they cannot afford to lock up, but cannot use to do anything they actually care about. The offer, plainly: keep every dollar of your own principal in your own name, redeemable by you alone, and let its yield — the part that would otherwise sit there doing nothing for you — go toward member enterprises you have a real vote over.",
  },
  {
    id: "small-is-all",
    source: "economics",
    quote: "Small is good, small is all (brown 2017): a member with a hundred dollars gets the same mechanism as one with a hundred thousand, growing one settled tally at a time, at the speed of trust.",
  },
  {
    id: "no-identity-test",
    source: "economics",
    quote: "Tidepool serves first the tiyóšpaye, their kin, and their friends; the tools are useful to anyone, and membership is open on the same terms to anyone who joins for what the pool does, the way anyone joins a credit union or a buyers\' co-op.",
  },
  {
    id: "constraint-no-token",
    source: "economics",
    quote: "No house-issued redeemable dollar token. The GENIUS Act (Public Law 119-27) SEC. 3(a) makes it unlawful for anyone but an approved, regulated \"permitted payment stablecoin issuer\" to issue a payment stablecoin in the United States; Tidepool is not, and does not seek to become, one.",
  },
  {
    id: "constraint-no-custody",
    source: "economics",
    quote: "Tidepool's design MUST keep every \"yes\" on the member's side until the exact moment a member's own signed transaction moves their already-claimed yield to the pool's address — at which point that amount becomes the pool's own property (a donor's-gift relation, not a transit of someone else's money).",
  },
  {
    id: "routing-step",
    source: "economics",
    quote: "Each cycle, a member (or an automation they arm and can revoke) redeems from their Morpho position exactly the share count equal to that cycle's accrued yield — never principal — converts to USDC, and sends it to the pool's own Base address in one member-signed transaction, interacting with the vault contract and the transfer directly.",
  },
  {
    id: "split-reserve",
    source: "economics",
    quote: "20% — Barrier Reserve. Grows the pool's own floor (`barrierSeries` in `pool.mjs`), the point below which no member can be re-seeded — the price of the pool being able to say \"your ruin is not absorbing\" at all.",
  },
  {
    id: "split-float",
    source: "economics",
    quote: "30% — Tally-Credit Float. Grows the pool's own liquid balance available to front `frontPoolDraw` calls — the capital backing a member's derived credit line (`deriveMemberCreditLine`'s `limit`), the larger retained bucket because it is the pool's actual product: circulation-secured credit, not a bank's balance test.",
  },
  {
    id: "split-distributable",
    source: "economics",
    quote: "50% — Distributable to member enterprises. Passed to the companion specification's distribution rule (fixed-even plus tally-weighted vote, mirroring Breadchain's 50/50 headline ratio as the *sub-split of this bucket*, not the whole).",
  },
  {
    id: "no-house-fee",
    source: "economics",
    quote: "The house fee: none, on directed yield. The reserve and float retentions stay inside the pool's own accounts (Assets, not Income to the 561 Group) — not a house margin.",
  },
  {
    id: "founders-hands-vs-machine-work",
    source: "economics",
    quote: "Machine work (MUST NOT be escalated to the founder): the claimable amount and unsigned transactions, the 20/30/50 split and its Beancount postings, the two-witness reconciliation, and the cycle-split record.",
  },
  {
    id: "falsifier-yield-below-cost",
    source: "economics",
    quote: "Yield below operating cost. The standing instrument's measured APY falls, net of routing gas, below the pool's own operating floor at the smallest actively-routing pool size for more than two consecutive cycles — the mechanism SHOULD batch to a longer cycle before retirement.",
  },
  {
    id: "falsifier-legal-reading",
    source: "economics",
    quote: "A legal reading closes the non-custodial routing. If FinCEN, a state regulator, or counsel determines the pool's Base address — once it aggregates yield from more than one member and redistributes it — has crossed from \"receiving its own now-owned property\" into \"transmitting value that belongs to another person\"",
  },
  {
    id: "falsifier-member-churn",
    source: "economics",
    quote: "Member churn. More than half of a rolling twelve-cycle window's routing members stop routing (miss three cycles, no exit notice) — the routing step is too much friction and SHOULD be reconsidered.",
  },
  {
    id: "governance-receiver-and-offer",
    source: "governance",
    quote: "The offer, plainly: join, build a settled-tally record, draw against a line derived from that record when a timing gap opens (rent due before a paycheck lands, a bill due before an invoice clears), repay at the inflow, and vote your share of each cycle's yield to the member enterprises the pool funds.",
  },
  {
    id: "admission-sponsor-vouch",
    source: "governance",
    quote: "`sponsor-vouch` — the cold-start sponsor rule (§ collapse-aware financial enterprises note, section 3): a member already in good tally standing pledges a bounded part of their own credit line to the applicant.",
  },
  {
    id: "admission-enterprise-roster",
    source: "governance",
    quote: "`enterprise-roster` — the applicant is, or is employed/contracted by, a member enterprise already admitted under § Member enterprises.",
  },
  {
    id: "admission-turntide-islander-role",
    source: "governance",
    quote: "`turntide-islander-role` — the applicant already holds the Turntide Islander Discord role in the Turntide Island guild that L-Space's own admission gate already checks",
  },
  {
    id: "exit-rules",
    source: "governance",
    quote: "A member MAY exit at any time by notice to the pool. On exit: every open draw MUST settle before the member's `ledgerPath` witness is retired (an exit request with an open draw MUST hold pending, never force a draw closed early)",
  },
  {
    id: "voting-power-weighting",
    source: "governance",
    quote: "Tidepool's voting power **MUST be weighted by matched tallies** (option 3): a member's vote weight for a cycle equals their `matchedPairs` count from `deriveMemberCreditLine` over the same `creditWindowDays` lookback, at the cycle's close.",
  },
  {
    id: "quorum-rule",
    source: "governance",
    quote: "Quorum. The voted portion MUST fall back to the fixed-portion rule (evenly across member enterprises) for any cycle with fewer than three members casting a nonzero-weight `tally-vote`.",
  },
  {
    id: "default-held-not-punished",
    source: "governance",
    quote: "A missed settlement is a condition to understand together, not a failure to punish: the pool meets the member where they are and holds the record open until it resolves, rather than treating a stale draw as grounds to push the member out",
  },
  {
    id: "default-never-removes",
    source: "governance",
    quote: "Default never removes a member. A stale half-tally only zeroes that member's `factor` (and so their line) per `deriveMemberCreditLine`; removal (§ Member enterprises, § Membership exit) requires the separate dialogue-and-vote sequence, never a default's automatic consequence.",
  },
  {
    id: "disclosure-members-see",
    source: "governance",
    quote: "Every member MUST be able to read the pool's own barrier series, every cycle's fixed/voted split and resulting per-enterprise amounts, and every member enterprise's reporting receipts in full. Members MUST NOT see another member's own draw amounts, ledger contents, or `admissionWitness` data beyond those aggregate figures",
  },
  {
    id: "disclosure-public-sees",
    source: "governance",
    quote: "The public MUST be able to see the roster of member enterprises and their offers, each cycle's split ratio and total amounts distributed (not per-member draws), and the falsifiers this specification names",
  },
  {
    id: "disclosure-cadence",
    source: "governance",
    quote: "Every cycle's split MUST be published within the settlement window's close, matching Breadchain's monthly cadence (record A) — and naming a cadence at all beats Breadchain's own measured gap",
  },
  {
    id: "member-enterprise-definition",
    source: "governance",
    quote: "A member enterprise's relationship to the pool is participation, not charity: it receives a share of directed yield for doing something real for the pool's members and reporting on it honestly",
  },
  {
    id: "org-form-recommendation",
    source: "governance",
    quote: "Recommended form: a state Limited Cooperative Association (LCA), Colorado or Wyoming.",
  },
  {
    id: "falsifier-participation",
    source: "governance",
    quote: "Participation. Fewer than three members cast a `tally-vote` in more than half of a rolling twelve-cycle window — the weighted vote is not being used, and the withdrawal-consensus alternative SHOULD be reconsidered as the default.",
  },
  {
    id: "falsifier-default-rate",
    source: "governance",
    quote: "Default rate. Tally-secured lines default at a *higher* rate than balance-secured lines of comparable size on a comparable incumbent",
  },
  {
    id: "falsifier-capture",
    source: "governance",
    quote: "Capture. Any set of members jointly holding more than half of a cycle's matched-tally weight for three consecutive cycles directs the voted portion to enterprises they control",
  },
  {
    id: "falsifier-admission-path-capture",
    source: "governance",
    quote: "Admission-path capture. Members admitted via `turntide-islander-role` fail their first sponsored draw at a materially higher rate than members admitted via `enterprise-roster` or an independent `sponsor-vouch`",
  },
]);

/**
 * Proves one quote is a real (whitespace-normalized) substring of its cited specification's
 * current body text.
 * @param {SpecQuote} spec
 * @param {string} bodyText The specification's Markdown body (frontmatter already stripped).
 * @returns {{ok: true} | {ok: false, reason: string}}
 */
export function verifySpecQuote(spec, bodyText) {
  if (!spec || typeof spec.quote !== "string") throw new TypeError("verifySpecQuote: spec.quote must be a string");
  if (typeof bodyText !== "string") throw new TypeError("verifySpecQuote: bodyText must be a string");
  const found = normalizeWhitespace(bodyText).includes(normalizeWhitespace(spec.quote));
  return found ? { ok: true } : { ok: false, reason: `quote "${spec.id}" not found verbatim in ${spec.source} specification` };
}

/**
 * Verifies every quote against its source's body text; throws naming every failing quote at
 * once rather than stopping at the first, so a build failure reports the whole gap.
 * @param {Record<"economics"|"governance", string>} bodiesBySource
 * @throws {Error} listing every quote id that failed verification
 */
export function verifyAllSpecQuotes(bodiesBySource) {
  const failures = SPEC_QUOTES
    .map((spec) => ({ spec, result: verifySpecQuote(spec, bodiesBySource[spec.source] ?? "") }))
    .filter(({ result }) => !result.ok)
    .map(({ result }) => result.reason);
  if (failures.length > 0) throw new Error(`spec quote verification failed:\n${failures.join("\n")}`);
}

/**
 * Looks up one quote by id, throwing loudly if a page references an id that does not exist —
 * a broken reference is a build error, never a silently blank quote.
 * @param {string} id
 * @returns {SpecQuote}
 */
export function specQuote(id) {
  const found = SPEC_QUOTES.find((spec) => spec.id === id);
  if (found === undefined) throw new Error(`spec-quotes: no quote registered with id "${id}"`);
  return found;
}
