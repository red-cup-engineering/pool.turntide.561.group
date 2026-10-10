import assert from "node:assert/strict";
import { test } from "node:test";
import {
  admissionRequestReadiness,
  deriveAdmitPoolMemberTemplate,
} from "../src/admission-request.mjs";

const BASE = Object.freeze({
  account: "pool:account-alice",
  chain: "base",
  contact: "alice@example.test",
  admissionWitness: Object.freeze({ kind: "enterprise-roster", enterpriseId: "ent-1" }),
});

const TECHNICAL = Object.freeze({
  settlementDestinations: Object.freeze([{ rail: "base", address: "0xabc" }]),
  ledgerWitness: Object.freeze({
    kind: "content-addressed-postings",
    recordNi: "ni:///sha-256;abc",
    provider: "member-store",
    subject: "ledger:alice",
  }),
});

test("stage-one intake has no authoritative operation template", () => {
  assert.equal(admissionRequestReadiness(BASE), "intake");
  assert.equal(deriveAdmitPoolMemberTemplate(BASE), null);
});

test("technically complete sponsor/enterprise intake projects only member-supplied pool fields", () => {
  const value = { ...BASE, ...TECHNICAL };
  assert.equal(admissionRequestReadiness(value), "operation-template-ready");
  assert.deepEqual(deriveAdmitPoolMemberTemplate(value), {
    account: value.account,
    settlementDestinations: value.settlementDestinations,
    ledgerWitness: value.ledgerWitness,
    admissionWitness: value.admissionWitness,
  });
  const json = JSON.stringify(deriveAdmitPoolMemberTemplate(value));
  assert.equal(json.includes("contact"), false);
  assert.equal(json.includes("chain"), false);
  assert.equal(json.includes("admittedAt"), false);
});

test("Turntide role claims remain blocked on the external verifier", () => {
  const value = {
    ...BASE,
    ...TECHNICAL,
    admissionWitness: {
      kind: "turntide-islander-role",
      discordSubjectHash: "claim",
      guildId: "g",
      roleId: "r",
      checkedAt: "2026-10-02T12:00:00Z",
    },
  };
  assert.equal(admissionRequestReadiness(value), "awaiting-role-verification");
  assert.equal(deriveAdmitPoolMemberTemplate(value), null);
});
