/** Enhances the TUFTE-rendered admission form with the domain’s witness union and JSON transport. */
const form = document.getElementById("admission-form");
const result = document.getElementById("admission-result");
const KIND_FIELDS = Object.freeze({
  "sponsor-vouch": ["sponsorAccount", "pledgedAmount"],
  "enterprise-roster": ["enterpriseId"],
  "turntide-islander-role": ["discordSubjectHash", "guildId", "roleId"],
});
function controls(name) { return [...form.querySelectorAll(`[name="${name}"]`)]; }
function setWitnessFields(kind) {
  for (const [candidate, names] of Object.entries(KIND_FIELDS)) {
    const active = candidate === kind;
    for (const name of names) for (const control of controls(name)) {
      control.closest(".tufte-form-field").hidden = !active;
      control.required = active;
    }
  }
}
for (const radio of controls("kind")) radio.addEventListener("change", () => setWitnessFields(radio.value));
setWitnessFields(form.querySelector('[name="kind"]:checked').value);
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const data = new FormData(form); const kind = data.get("kind");
  const admissionWitness = { kind };
  for (const field of KIND_FIELDS[kind]) admissionWitness[field] = data.get(field) ?? "";
  if (kind === "turntide-islander-role") admissionWitness.checkedAt = new Date().toISOString();
  const body = { account: data.get("account"), chain: data.get("chain"), contact: data.get("contact"), admissionWitness };
  const technical = {
    destination: String(data.get("destination") ?? "").trim(),
    provider: String(data.get("ledgerProvider") ?? "").trim(),
    subject: String(data.get("ledgerSubject") ?? "").trim(),
    recordNi: String(data.get("ledgerRecordNi") ?? "").trim(),
  };
  const supplied = Object.values(technical).filter((value) => value.length > 0).length;
  if (supplied > 0 && supplied !== 4) {
    result.textContent = "Technical onboarding is all-or-none: provide the settlement destination and all three ledger-witness fields, or leave all four blank.";
    return;
  }
  if (supplied === 4) {
    const rail = String(data.get("chain") ?? "").trim();
    if (rail === "base") body.settlementDestinations = [{ rail: "base", address: technical.destination }];
    else if (rail === "hive") body.settlementDestinations = [{ rail: "hive", account: technical.destination }];
    else {
      result.textContent = "Technical onboarding currently supports Base or Hive as the settlement rail.";
      return;
    }
    body.ledgerWitness = {
      kind: "content-addressed-postings",
      provider: technical.provider,
      subject: technical.subject,
      recordNi: technical.recordNi,
    };
  }

  result.textContent = "Submitting…";
  try {
    const response = await fetch(form.action, { method: form.method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const payload = await response.json();
    if (!response.ok) {
      result.textContent = `Refused: ${payload.error ?? "unknown reason"}`;
    } else if (payload.readiness === "operation-template-ready") {
      result.textContent = "Request recorded with Membership v2 identity resources. The authorized pool receiver can now verify the admission path and prepare the pool-service admission.";
    } else if (payload.readiness === "awaiting-role-verification") {
      result.textContent = "Request recorded with Membership v2 identity resources. The Turntide role claim still needs the live role verifier before admission.";
    } else {
      result.textContent = "Request recorded. The pool's admission lot will follow up to establish the settlement destination and member-controlled ledger witness.";
    }
  } catch (error) { result.textContent = `Error: ${error.message}`; }
});
