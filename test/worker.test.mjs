import assert from "node:assert/strict";
import { test } from "node:test";
import worker from "../worker.mjs";

function fakeEnv() {
  const stored = new Map();
  return {
    ASSETS: { fetch: async () => new Response("asset", { status: 200 }) },
    ADMISSION_REQUESTS: {
      put: async (key, value) => { stored.set(key, value); },
    },
    stored,
  };
}

const VALID_BODY = {
  account: "alice",
  chain: "base",
  contact: "alice@example.test",
  admissionWitness: { kind: "enterprise-roster", enterpriseId: "climate-desk" },
};

test("POST /api/admission-request with a schema-valid body stores a dated KV record and returns 201", async () => {
  const env = fakeEnv();
  const response = await worker.fetch(new Request("https://pool.turntide.561.group/api/admission-request", { method: "POST", body: JSON.stringify(VALID_BODY) }), env);
  assert.equal(response.status, 201);
  const payload = await response.json();
  assert.equal(payload.ok, true);
  assert.equal(payload.readiness, "intake");
  assert.equal(env.stored.size, 1);
  const stored = JSON.parse([...env.stored.values()][0]);
  assert.equal(stored.readiness, "intake");
  assert.equal(stored.operationTemplate, null);
});

test("POST /api/admission-request refuses a body missing a required field, naming the reason", async () => {
  const env = fakeEnv();
  const { contact, ...withoutContact } = VALID_BODY;
  const response = await worker.fetch(new Request("https://pool.turntide.561.group/api/admission-request", { method: "POST", body: JSON.stringify(withoutContact) }), env);
  assert.equal(response.status, 400);
  const payload = await response.json();
  assert.match(payload.error, /schema validation/u);
  assert.equal(env.stored.size, 0);
});

test("POST /api/admission-request refuses an admissionWitness with a kind not in the union", async () => {
  const env = fakeEnv();
  const body = { ...VALID_BODY, admissionWitness: { kind: "not-a-real-path" } };
  const response = await worker.fetch(new Request("https://pool.turntide.561.group/api/admission-request", { method: "POST", body: JSON.stringify(body) }), env);
  assert.equal(response.status, 400);
  assert.equal(env.stored.size, 0);
});

test("POST /api/admission-request preserves v2 resources as an operation-template-ready record", async () => {
  const env = fakeEnv();
  const body = {
    ...VALID_BODY,
    settlementDestinations: [{ rail: "base", address: "0xabc" }],
    ledgerWitness: {
      kind: "content-addressed-postings",
      recordNi: "ni:///sha-256;abc",
      provider: "member-store",
      subject: "ledger:alice",
    },
  };
  const response = await worker.fetch(new Request("https://pool.turntide.561.group/api/admission-request", { method: "POST", body: JSON.stringify(body) }), env);
  assert.equal(response.status, 201);
  const payload = await response.json();
  assert.equal(payload.readiness, "operation-template-ready");
  const stored = JSON.parse([...env.stored.values()][0]);
  assert.deepEqual(stored.settlementDestinations, body.settlementDestinations);
  assert.deepEqual(stored.ledgerWitness, body.ledgerWitness);
  assert.deepEqual(stored.operationTemplate, {
    account: body.account,
    settlementDestinations: body.settlementDestinations,
    ledgerWitness: body.ledgerWitness,
    admissionWitness: body.admissionWitness,
  });
  assert.equal(Object.hasOwn(stored.operationTemplate, "contact"), false);
  assert.equal(Object.hasOwn(stored.operationTemplate, "chain"), false);
  assert.equal(Object.hasOwn(stored.operationTemplate, "admittedAt"), false);
  assert.equal(JSON.stringify(stored).includes("ledgerPath"), false);
});

test("POST /api/admission-request keeps a technically complete Turntide role claim pending live verification", async () => {
  const env = fakeEnv();
  const body = {
    ...VALID_BODY,
    settlementDestinations: [{ rail: "base", address: "0xabc" }],
    ledgerWitness: {
      kind: "content-addressed-postings",
      recordNi: "ni:///sha-256;abc",
      provider: "member-store",
      subject: "ledger:alice",
    },
    admissionWitness: {
      kind: "turntide-islander-role",
      discordSubjectHash: "claim-only",
      guildId: "g1",
      roleId: "r1",
      checkedAt: "2026-10-02T12:00:00Z",
    },
  };
  const response = await worker.fetch(new Request("https://pool.turntide.561.group/api/admission-request", { method: "POST", body: JSON.stringify(body) }), env);
  assert.equal(response.status, 201);
  assert.equal((await response.json()).readiness, "awaiting-role-verification");
  const stored = JSON.parse([...env.stored.values()][0]);
  assert.equal(stored.operationTemplate, null);
});

test("POST /api/admission-request refuses half-configured v2 identity resources", async () => {
  const env = fakeEnv();
  const body = { ...VALID_BODY, settlementDestinations: [{ rail: "base", address: "0xabc" }] };
  const response = await worker.fetch(new Request("https://pool.turntide.561.group/api/admission-request", { method: "POST", body: JSON.stringify(body) }), env);
  assert.equal(response.status, 400);
  assert.equal(env.stored.size, 0);
});

test("POST /api/admission-request refuses a chain that contradicts the supplied v2 destinations", async () => {
  const env = fakeEnv();
  const body = {
    ...VALID_BODY,
    chain: "hive",
    settlementDestinations: [{ rail: "base", address: "0xabc" }],
    ledgerWitness: {
      kind: "content-addressed-postings",
      recordNi: "ni:///sha-256;abc",
      provider: "member-store",
      subject: "ledger:alice",
    },
  };
  const response = await worker.fetch(new Request("https://pool.turntide.561.group/api/admission-request", { method: "POST", body: JSON.stringify(body) }), env);
  assert.equal(response.status, 400);
  assert.equal(env.stored.size, 0);
});

test("GET /api/admission-requests is not exposed", async () => {
  const env = fakeEnv();
  const response = await worker.fetch(new Request("https://pool.turntide.561.group/api/admission-requests", { method: "GET" }), env);
  assert.equal(response.status, 404);
});

test("GET /api/admission-request (wrong method) is refused, not silently accepted", async () => {
  const env = fakeEnv();
  const response = await worker.fetch(new Request("https://pool.turntide.561.group/api/admission-request", { method: "GET" }), env);
  assert.equal(response.status, 405);
});

test("any non-/api path falls through to the ASSETS binding", async () => {
  const env = fakeEnv();
  const response = await worker.fetch(new Request("https://pool.turntide.561.group/how-it-works/"), env);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "asset");
});

test("native TUFTE form submission admits the selected witness shape without JavaScript", async () => {
  const env = fakeEnv();
  const response = await worker.fetch(new Request("https://pool.turntide.561.group/api/admission-request", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ account: "alice", chain: "base", contact: "alice@example.test", kind: "enterprise-roster", enterpriseId: "climate-desk" }),
  }), env);
  assert.equal(response.status, 201);
  assert.equal((await response.json()).readiness, "intake");
  assert.equal(env.stored.size, 1);
});
