/**
 * Pure admission-intake projection.
 *
 * The public site is a receiver, not the pool's admission authority. This module only says
 * whether an intake has enough member-supplied Membership v2 identity resources to form the
 * request body that authoritative pool-service can later verify and execute.
 */


function object(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function text(value, min, max) {
  return typeof value === "string" && value.length >= min && value.length <= max;
}

function exactKeys(value, keys) {
  return object(value) && Object.keys(value).every((key) => keys.includes(key));
}

function validateWitness(witness, errors) {
  if (!object(witness) || typeof witness.kind !== "string") {
    errors.push("admissionWitness must be an object with kind");
    return;
  }
  if (witness.kind === "sponsor-vouch") {
    if (!exactKeys(witness, ["kind", "sponsorAccount", "pledgedAmount"])) errors.push("sponsor-vouch contains unsupported fields");
    if (!text(witness.sponsorAccount, 1, 200)) errors.push("sponsorAccount must be 1..200 characters");
    if (!text(witness.pledgedAmount, 1, 100) || !/^\d+(?:\.\d+)?$/u.test(witness.pledgedAmount)) errors.push("pledgedAmount must be a non-negative decimal string");
    return;
  }
  if (witness.kind === "enterprise-roster") {
    if (!exactKeys(witness, ["kind", "enterpriseId"])) errors.push("enterprise-roster contains unsupported fields");
    if (!text(witness.enterpriseId, 1, 200)) errors.push("enterpriseId must be 1..200 characters");
    return;
  }
  if (witness.kind === "turntide-islander-role") {
    if (!exactKeys(witness, ["kind", "discordSubjectHash", "guildId", "roleId", "checkedAt"])) errors.push("turntide-islander-role contains unsupported fields");
    if (!text(witness.discordSubjectHash, 1, 200)) errors.push("discordSubjectHash must be 1..200 characters");
    if (!text(witness.guildId, 1, 100)) errors.push("guildId must be 1..100 characters");
    if (!text(witness.roleId, 1, 100)) errors.push("roleId must be 1..100 characters");
    if (typeof witness.checkedAt !== "string" || Number.isNaN(Date.parse(witness.checkedAt))) errors.push("checkedAt must be an ISO date/time string");
    return;
  }
  errors.push("admissionWitness.kind is not supported");
}

export function validateAdmissionRequest(value) {
  const errors = [];
  const allowed = ["account", "chain", "contact", "admissionWitness", "settlementDestinations", "ledgerWitness"];
  if (!exactKeys(value, allowed)) errors.push("admission request must be an object containing only supported fields");
  if (!object(value)) return Object.freeze({ valid: false, errors: Object.freeze(errors) });
  if (!text(value.account, 1, 200)) errors.push("account must be 1..200 characters");
  if (!text(value.chain, 1, 100)) errors.push("chain must be 1..100 characters");
  if (!text(value.contact, 3, 320)) errors.push("contact must be 3..320 characters");
  validateWitness(value.admissionWitness, errors);

  const hasDestinations = value.settlementDestinations !== undefined;
  const hasLedgerWitness = value.ledgerWitness !== undefined;
  if (hasDestinations !== hasLedgerWitness) errors.push("settlementDestinations and ledgerWitness must be supplied together");

  if (hasDestinations) {
    if (!Array.isArray(value.settlementDestinations) || value.settlementDestinations.length < 1 || value.settlementDestinations.length > 2) {
      errors.push("settlementDestinations must contain one or two destinations");
    } else {
      const rails = [];
      for (const destination of value.settlementDestinations) {
        if (!object(destination) || typeof destination.rail !== "string") {
          errors.push("each settlement destination must be an object with rail");
          continue;
        }
        rails.push(destination.rail);
        if (destination.rail === "base") {
          if (!exactKeys(destination, ["rail", "address"]) || !text(destination.address, 1, 200)) errors.push("base destination must contain only a 1..200 character address");
        } else if (destination.rail === "hive") {
          if (!exactKeys(destination, ["rail", "account"]) || !text(destination.account, 1, 200)) errors.push("hive destination must contain only a 1..200 character account");
        } else errors.push("unsupported settlement rail");
      }
      if (new Set(rails).size !== rails.length) errors.push("settlement destinations may name each rail at most once");
      if (!rails.includes(value.chain)) errors.push("chain must name one of the supplied settlement destinations");
    }
  }

  if (hasLedgerWitness) {
    const witness = value.ledgerWitness;
    if (!exactKeys(witness, ["kind", "recordNi", "provider", "subject"])) errors.push("ledgerWitness contains unsupported fields");
    if (witness?.kind !== "content-addressed-postings") errors.push("ledgerWitness.kind must be content-addressed-postings");
    if (typeof witness?.recordNi !== "string" || !/^ni:\/\/\/sha-256;[A-Za-z0-9_-]+$/u.test(witness.recordNi)) errors.push("ledgerWitness.recordNi must be a sha-256 ni URI");
    if (!text(witness?.provider, 1, 200)) errors.push("ledgerWitness.provider must be 1..200 characters");
    if (!text(witness?.subject, 1, 500)) errors.push("ledgerWitness.subject must be 1..500 characters");
  }

  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}

export function admissionRequestReadiness(value) {
  if (value?.settlementDestinations === undefined || value?.ledgerWitness === undefined) return "intake";
  if (value?.admissionWitness?.kind === "turntide-islander-role") return "awaiting-role-verification";
  return "operation-template-ready";
}

/**
 * Project a technically complete intake into the authoritative operation's member-supplied
 * fields. Returns null until the request is ready. Contact, chain, and receiver metadata
 * intentionally do not enter the pool-service request.
 *
 * admittedAt is also intentionally absent: the authorized executor stamps it at the moment
 * it performs verification/admission.
 */
export function deriveAdmitPoolMemberTemplate(value) {
  if (admissionRequestReadiness(value) !== "operation-template-ready") return null;
  return Object.freeze({
    account: value.account,
    settlementDestinations: Object.freeze(value.settlementDestinations.map((destination) => Object.freeze({ ...destination }))),
    ledgerWitness: Object.freeze({ ...value.ledgerWitness }),
    admissionWitness: Object.freeze({ ...value.admissionWitness }),
  });
}
