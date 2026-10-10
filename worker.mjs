/** Tidepool HTTP boundary: shared application routing plus the Cloudflare asset/KV capabilities. */
import { admissionRequestReadiness, deriveAdmitPoolMemberTemplate, validateAdmissionRequest } from "./src/admission-request.mjs";

async function handleAdmissionRequest(request, env) {
  let value;
  try {
    if (request.headers.get("content-type")?.includes("application/x-www-form-urlencoded")) {
      const fields = Object.fromEntries(await request.formData());
      const kind = fields.kind;
      const admissionWitness = { kind };
      for (const name of kind === "sponsor-vouch" ? ["sponsorAccount", "pledgedAmount"] : kind === "enterprise-roster" ? ["enterpriseId"] : kind === "turntide-islander-role" ? ["discordSubjectHash", "guildId", "roleId"] : []) admissionWitness[name] = fields[name] ?? "";
      if (kind === "turntide-islander-role") admissionWitness.checkedAt = new Date().toISOString();

      value = { account: fields.account, chain: fields.chain, contact: fields.contact, admissionWitness };
      const technicalFields = ["destination", "ledgerProvider", "ledgerSubject", "ledgerRecordNi"];
      const supplied = technicalFields.filter((name) => typeof fields[name] === "string" && fields[name].trim().length > 0);
      if (supplied.length > 0 && supplied.length !== technicalFields.length) {
        return Response.json({ error: "technical onboarding is all-or-none: destination, ledgerProvider, ledgerSubject, and ledgerRecordNi are all required together" }, { status: 400 });
      }
      if (supplied.length === technicalFields.length) {
        if (fields.chain === "base") value.settlementDestinations = [{ rail: "base", address: fields.destination }];
        else if (fields.chain === "hive") value.settlementDestinations = [{ rail: "hive", account: fields.destination }];
        else return Response.json({ error: "technical onboarding currently supports base or hive settlement rails" }, { status: 400 });
        value.ledgerWitness = {
          kind: "content-addressed-postings",
          recordNi: fields.ledgerRecordNi,
          provider: fields.ledgerProvider,
          subject: fields.ledgerSubject,
        };
      }
    } else value = JSON.parse(await request.text());
  } catch {
    return Response.json({ error: "malformed admission request" }, { status: 400 });
  }

  const { valid, errors } = validateAdmissionRequest(value);
  if (!valid) return Response.json({ error: "admission request failed schema validation", details: errors }, { status: 400 });

  if (value.settlementDestinations) {
    const rails = value.settlementDestinations.map((destination) => destination.rail);
    if (new Set(rails).size !== rails.length) {
      return Response.json({ error: "membership-v2 settlement destinations may name each rail at most once" }, { status: 400 });
    }
    if (!rails.includes(value.chain)) {
      return Response.json({ error: "chain must name one of the supplied settlement destinations" }, { status: 400 });
    }
  }

  const readiness = admissionRequestReadiness(value);
  const operationTemplate = deriveAdmitPoolMemberTemplate(value);
  const recordedAt = new Date().toISOString();
  const key = `admission-request/${recordedAt}/${crypto.randomUUID()}`;
  await env.ADMISSION_REQUESTS.put(key, JSON.stringify({ ...value, readiness, operationTemplate, recordedAt }));
  return Response.json({ ok: true, readiness, recordedAt }, { status: 201 });
}

export default {
  /** @param {Request} request @param {{ASSETS: Fetcher, ADMISSION_REQUESTS: KVNamespace}} env */
  async fetch(request, env) {
    const pathname = new URL(request.url).pathname;
    if (pathname === "/api/admission-request") {
      if (request.method !== "POST") {
        return Response.json({ error: "method not allowed" }, { status: 405, headers: { allow: "POST" } });
      }
      return handleAdmissionRequest(request, env);
    }
    if (pathname.startsWith("/api/")) return Response.json({ error: "not found" }, { status: 404 });
    return env.ASSETS.fetch(request);
  },
};
