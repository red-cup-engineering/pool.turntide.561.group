import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { appendReceivedDisclosure, projectPoolServiceDisclosure } from "../src/public-pool-projection.mjs";
import { importPoolDisclosure } from "../scripts/import-pool-disclosure.mjs";

const DISCLOSURE = Object.freeze({
  type: "PoolCycleDisclosure",
  cycleId: "cycle-1",
  publishedAt: "2026-10-02T20:00:00Z",
  members: {
    privateSentinel: "MUST-NOT-REACH-PUBLIC-PROJECTION",
    barrierSeries: [{ date: "2026-10-01", amount: "40.125" }],
  },
  public: {
    roster: [{ enterpriseId: "ent-a", offer: "repair things" }],
    cycle: {
      cycleId: "cycle-1",
      commodity: "USDC",
      totalYield: "10.000001",
      reserve: "2.000001",
      float: "3",
      distributable: "5",
      fixedPortion: "2.5",
      votedPortion: "2.5",
      quorumMet: false,
      voteMode: "equal-fallback",
      splitRatioPercent: { reserve: 20, float: 30, distributable: 50 },
      perEnterpriseTotals: [{ enterpriseId: "ent-a", total: "5" }],
    },
    falsifiers: ["yield below operating cost"],
  },
});

const PROVENANCE = Object.freeze({
  operationReceipt:"ni:///sha-256;operation_receipt_123",
  recordNi:"ni:///sha-256;record_digest_123",
  recordRef:"pool-service:data/records/cycle-1.json",
  importedAt:"2026-10-02T20:01:00Z",
});

test("received entry keeps exact public decimals and strips the members view entirely", () => {
  const received=projectPoolServiceDisclosure(DISCLOSURE,PROVENANCE);
  assert.equal(received.public.cycle.totalYield,"10.000001");
  assert.equal(received.public.cycle.reserve,"2.000001");
  assert.equal(received.public.cycle.quorumMet,false);
  assert.equal(received.public.cycle.voteMode,"equal-fallback");
  assert.equal(received.source.operationReceipt,PROVENANCE.operationReceipt);
  assert.equal(received.source.recordNi,PROVENANCE.recordNi);
  assert.equal("members" in received,false);
  assert.equal(JSON.stringify(received).includes("MUST-NOT-REACH-PUBLIC-PROJECTION"),false);
});

test("projection binds cycle identity and NI-shaped operation/content receipts", () => {
  assert.throws(()=>projectPoolServiceDisclosure({...DISCLOSURE,cycleId:"other"},PROVENANCE),/cycleId does not match/u);
  assert.throws(()=>projectPoolServiceDisclosure(DISCLOSURE,{...PROVENANCE,operationReceipt:"not-a-receipt"}),/ni:\/\/\/sha-256/u);
  assert.throws(()=>projectPoolServiceDisclosure(DISCLOSURE,{...PROVENANCE,recordNi:"not-a-record-ni"}),/ni:\/\/\/sha-256/u);
});

test("append is idempotent for the same cycle+content and refuses conflicting cycle contents", () => {
  const empty={$schema:"./schema/public-pool-projection.schema.json",type:"TidepoolPublicProjection",state:"unreceived",disclosures:[]};
  const received=projectPoolServiceDisclosure(DISCLOSURE,PROVENANCE);
  const first=appendReceivedDisclosure(empty,received);
  assert.equal(first.appended,true);
  assert.equal(first.projection.disclosures.length,1);
  assert.equal(first.projection.state,"received");

  const second=appendReceivedDisclosure(first.projection,received);
  assert.equal(second.appended,false);
  assert.equal(second.projection.disclosures.length,1);

  const conflict=projectPoolServiceDisclosure(DISCLOSURE,{...PROVENANCE,recordNi:"ni:///sha-256;different_content"});
  assert.throws(()=>appendReceivedDisclosure(first.projection,conflict),/different disclosure content/u);
});

test("append refuses an internally inconsistent or duplicate-cycle current projection", () => {
  const received=projectPoolServiceDisclosure(DISCLOSURE,PROVENANCE);
  assert.throws(()=>appendReceivedDisclosure({
    $schema:"./schema/public-pool-projection.schema.json",type:"TidepoolPublicProjection",state:"unreceived",disclosures:[received],
  },received),/unreceived projection cannot contain disclosures/u);
  assert.throws(()=>appendReceivedDisclosure({
    $schema:"./schema/public-pool-projection.schema.json",type:"TidepoolPublicProjection",state:"received",disclosures:[received,received],
  },received),/duplicate cycle ids/u);
});

test("import content-addresses exact bytes, appends history idempotently, and never persists members-only data", async () => {
  const dir=await mkdtemp(path.join(tmpdir(),"tidepool-public-projection-"));
  const input=path.join(dir,"disclosure.json");
  const output=path.join(dir,"projection.json");
  const recordText=`${JSON.stringify(DISCLOSURE)}\n`;
  await writeFile(input,recordText,"utf8");
  const expectedNi=`ni:///sha-256;${createHash("sha256").update(recordText,"utf8").digest("base64url")}`;

  const args={
    recordPath:input,
    operationReceipt:PROVENANCE.operationReceipt,
    recordRef:PROVENANCE.recordRef,
    importedAt:PROVENANCE.importedAt,
    outputPath:output,
  };
  const first=await importPoolDisclosure(args);
  assert.equal(first.appended,true);
  assert.equal(first.recordNi,expectedNi);
  const second=await importPoolDisclosure(args);
  assert.equal(second.appended,false);

  const text=await readFile(output,"utf8");
  const stored=JSON.parse(text);
  assert.equal(stored.disclosures.length,1);
  assert.equal(stored.disclosures[0].source.recordNi,expectedNi);
  assert.equal(stored.disclosures[0].public.cycle.totalYield,"10.000001");
  assert.equal(stored.disclosures[0].public.cycle.quorumMet,false);
  assert.equal(stored.disclosures[0].public.cycle.voteMode,"equal-fallback");
  assert.equal(text.includes("MUST-NOT-REACH-PUBLIC-PROJECTION"),false);
  assert.equal(text.includes('"members"'),false);
});


test("projection requires authoritative quorum and vote-mode fields", () => {
  const missingQuorum = {
    ...DISCLOSURE,
    public: {
      ...DISCLOSURE.public,
      cycle: { ...DISCLOSURE.public.cycle, quorumMet: undefined },
    },
  };
  assert.throws(() => projectPoolServiceDisclosure(missingQuorum, PROVENANCE), /quorumMet must be a boolean/u);
  const invalidMode = {
    ...DISCLOSURE,
    public: {
      ...DISCLOSURE.public,
      cycle: { ...DISCLOSURE.public.cycle, voteMode: "client-decides" },
    },
  };
  assert.throws(() => projectPoolServiceDisclosure(invalidMode, PROVENANCE), /voteMode must be weighted or equal-fallback/u);
});
