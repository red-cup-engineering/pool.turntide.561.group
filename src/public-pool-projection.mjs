/**
 * Projection boundary from pool-service's PoolCycleDisclosure into the public Tidepool site.
 * This module is not a pool authority. It accepts an already-produced disclosure plus its
 * receipt, verifies the narrow public contract needed here, and copies only disclosure.public.
 * The members view is deliberately unreachable in the returned object.
 */

function requireObject(name, value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`public-pool-projection: ${name} must be an object`);
  return value;
}

function requireText(name, value) {
  if (typeof value !== "string" || value.trim() === "") throw new TypeError(`public-pool-projection: ${name} must be a non-empty string`);
  return value;
}

function requireIsoDateTime(name, value) {
  requireText(name, value);
  if (Number.isNaN(Date.parse(value))) throw new TypeError(`public-pool-projection: ${name} must be an ISO date/time string`);
  return value;
}

function requireNiReceipt(receipt) {
  requireText("receipt", receipt);
  if (!/^ni:\/\/\/sha-256;[A-Za-z0-9_-]+$/u.test(receipt)) throw new TypeError("public-pool-projection: receipt must be a ni:///sha-256 content identifier");
  return receipt;
}

function copyRoster(roster) {
  if (!Array.isArray(roster)) throw new TypeError("public-pool-projection: public.roster must be an array");
  return roster.map((row, index) => {
    requireObject(`public.roster[${index}]`, row);
    return Object.freeze({
      enterpriseId: requireText(`public.roster[${index}].enterpriseId`, row.enterpriseId),
      offer: requireText(`public.roster[${index}].offer`, row.offer),
    });
  });
}

function copyCycle(cycle) {
  requireObject("public.cycle", cycle);
  const splitRatioPercent=requireObject("public.cycle.splitRatioPercent", cycle.splitRatioPercent);
  if (!Array.isArray(cycle.perEnterpriseTotals)) throw new TypeError("public-pool-projection: public.cycle.perEnterpriseTotals must be an array");
  for (const field of ["totalYield","reserve","float","distributable","fixedPortion","votedPortion"]) requireText(`public.cycle.${field}`, cycle[field]);
  if (typeof cycle.quorumMet !== "boolean") throw new TypeError("public-pool-projection: public.cycle.quorumMet must be a boolean");
  if (!["weighted","equal-fallback"].includes(cycle.voteMode)) throw new TypeError("public-pool-projection: public.cycle.voteMode must be weighted or equal-fallback");
  for (const field of ["reserve","float","distributable"]) if (!Number.isInteger(splitRatioPercent[field])) throw new TypeError(`public-pool-projection: splitRatioPercent.${field} must be an integer`);
  return Object.freeze({
    cycleId: requireText("public.cycle.cycleId", cycle.cycleId),
    commodity: requireText("public.cycle.commodity", cycle.commodity),
    totalYield: cycle.totalYield,
    reserve: cycle.reserve,
    float: cycle.float,
    distributable: cycle.distributable,
    fixedPortion: cycle.fixedPortion,
    votedPortion: cycle.votedPortion,
    quorumMet: cycle.quorumMet,
    voteMode: cycle.voteMode,
    splitRatioPercent: Object.freeze({
      reserve: splitRatioPercent.reserve,
      float: splitRatioPercent.float,
      distributable: splitRatioPercent.distributable,
    }),
    perEnterpriseTotals: Object.freeze(cycle.perEnterpriseTotals.map((row, index) => {
      requireObject(`public.cycle.perEnterpriseTotals[${index}]`, row);
      return Object.freeze({
        enterpriseId: requireText(`public.cycle.perEnterpriseTotals[${index}].enterpriseId`, row.enterpriseId),
        total: requireText(`public.cycle.perEnterpriseTotals[${index}].total`, row.total),
      });
    })),
  });
}

/**
 * @param {object} disclosure pool-service PoolCycleDisclosure
 * @param {{operationReceipt:string, recordNi:string, recordRef:string, importedAt:string}} provenance
 */
export function projectPoolServiceDisclosure(disclosure, { operationReceipt, recordNi, recordRef, importedAt }) {
  requireObject("disclosure", disclosure);
  if (disclosure.type !== "PoolCycleDisclosure") throw new TypeError("public-pool-projection: disclosure.type must be PoolCycleDisclosure");
  const cycleId=requireText("disclosure.cycleId", disclosure.cycleId);
  const cyclePublishedAt=requireIsoDateTime("disclosure.publishedAt", disclosure.publishedAt);
  const publicView=requireObject("disclosure.public", disclosure.public);
  const cycle=copyCycle(publicView.cycle);
  if (cycle.cycleId !== cycleId) throw new TypeError("public-pool-projection: disclosure cycleId does not match public.cycle.cycleId");
  if (!Array.isArray(publicView.falsifiers)) throw new TypeError("public-pool-projection: public.falsifiers must be an array");

  return Object.freeze({
    source: Object.freeze({
      producer: "@red-cup-engineering/pool-service",
      operation: "publish-cycle-disclosure",
      operationReceipt: requireNiReceipt(operationReceipt),
      recordNi: requireNiReceipt(recordNi),
      recordRef: requireText("recordRef", recordRef),
      importedAt: requireIsoDateTime("importedAt", importedAt),
      cyclePublishedAt,
    }),
    public: Object.freeze({
      roster: Object.freeze(copyRoster(publicView.roster)),
      cycle,
      falsifiers: Object.freeze(publicView.falsifiers.map((value,index)=>requireText(`public.falsifiers[${index}]`,value))),
    }),
  });
}

/**
 * Adds one received disclosure to the website projection without rewriting prior cycle history.
 * The same cycle+record NI is idempotent. Reusing a cycle id with different content is a
 * conflict and MUST be reconciled at the producing pool-service rather than overwritten here.
 * @param {object} current
 * @param {{source:object, public:object}} received
 * @returns {{projection:object, appended:boolean}}
 */
export function appendReceivedDisclosure(current, received) {
  requireObject("current projection", current);
  if (current.type !== "TidepoolPublicProjection") throw new TypeError("public-pool-projection: current.type must be TidepoolPublicProjection");
  if (!Array.isArray(current.disclosures)) throw new TypeError("public-pool-projection: current.disclosures must be an array");
  if (!["unreceived","received"].includes(current.state)) throw new TypeError("public-pool-projection: current.state must be unreceived or received");
  if (current.state === "unreceived" && current.disclosures.length !== 0) throw new Error("public-pool-projection: unreceived projection cannot contain disclosures");
  if (current.state === "received" && current.disclosures.length === 0) throw new Error("public-pool-projection: received projection must contain at least one disclosure");
  const cycleIds=current.disclosures.map((entry)=>entry?.public?.cycle?.cycleId);
  if (new Set(cycleIds).size !== cycleIds.length) throw new Error("public-pool-projection: current projection contains duplicate cycle ids");
  requireObject("received", received);
  requireObject("received.source", received.source);
  requireObject("received.public", received.public);
  requireObject("received.public.cycle", received.public.cycle);

  const cycleId=requireText("received.public.cycle.cycleId",received.public.cycle.cycleId);
  const prior=current.disclosures.find((entry)=>entry?.public?.cycle?.cycleId===cycleId);
  if (prior !== undefined) {
    if (prior.source?.recordNi !== received.source.recordNi) {
      throw new Error(`public-pool-projection: cycle "${cycleId}" already exists with different disclosure content`);
    }
    return Object.freeze({projection:current,appended:false});
  }

  const disclosures=Object.freeze([...current.disclosures,received]);
  return Object.freeze({
    appended:true,
    projection:Object.freeze({
      $schema:"./schema/public-pool-projection.schema.json",
      type:"TidepoolPublicProjection",
      state:"received",
      disclosures,
    }),
  });
}


function exactObjectKeys(name, value, keys) {
  requireObject(name, value);
  for (const key of Object.keys(value)) {
    if (!keys.includes(key)) throw new TypeError("public-pool-projection: " + name + " contains unsupported field " + JSON.stringify(key));
  }
}

export function assertPublicPoolProjection(value) {
  exactObjectKeys("projection", value, ["$schema", "type", "state", "disclosures"]);
  requireText("$schema", value.$schema);
  if (value.type !== "TidepoolPublicProjection") throw new TypeError("public-pool-projection: type must be TidepoolPublicProjection");
  if (!["unreceived", "received"].includes(value.state)) throw new TypeError("public-pool-projection: state must be unreceived or received");
  if (!Array.isArray(value.disclosures)) throw new TypeError("public-pool-projection: disclosures must be an array");
  if (value.state === "unreceived" && value.disclosures.length !== 0) throw new TypeError("public-pool-projection: unreceived projection must have no disclosures");
  if (value.state === "received" && value.disclosures.length === 0) throw new TypeError("public-pool-projection: received projection must have at least one disclosure");

  const cycles = [];
  for (const [index, entry] of value.disclosures.entries()) {
    exactObjectKeys("disclosures[" + index + "]", entry, ["source", "public"]);
    exactObjectKeys("disclosures[" + index + "].source", entry.source, ["producer", "operation", "operationReceipt", "recordNi", "recordRef", "importedAt", "cyclePublishedAt"]);
    if (entry.source.producer !== "@red-cup-engineering/pool-service") throw new TypeError("public-pool-projection: source producer must be pool-service");
    if (entry.source.operation !== "publish-cycle-disclosure") throw new TypeError("public-pool-projection: source operation must be publish-cycle-disclosure");
    requireNiReceipt(entry.source.operationReceipt);
    requireNiReceipt(entry.source.recordNi);
    requireText("recordRef", entry.source.recordRef);
    requireIsoDateTime("importedAt", entry.source.importedAt);
    requireIsoDateTime("cyclePublishedAt", entry.source.cyclePublishedAt);

    exactObjectKeys("disclosures[" + index + "].public", entry.public, ["roster", "cycle", "falsifiers"]);
    copyRoster(entry.public.roster);
    const cycle = copyCycle(entry.public.cycle);
    if (!Array.isArray(entry.public.falsifiers)) throw new TypeError("public-pool-projection: public.falsifiers must be an array");
    entry.public.falsifiers.forEach((item, i) => requireText("public.falsifiers[" + i + "]", item));
    cycles.push(cycle.cycleId);
  }
  if (new Set(cycles).size !== cycles.length) throw new TypeError("public-pool-projection: duplicate cycle ids");
  return value;
}

export function validatePublicPoolProjection(value) {
  try {
    assertPublicPoolProjection(value);
    return Object.freeze({ valid: true, errors: Object.freeze([]) });
  } catch (error) {
    return Object.freeze({ valid: false, errors: Object.freeze([error.message]) });
  }
}
