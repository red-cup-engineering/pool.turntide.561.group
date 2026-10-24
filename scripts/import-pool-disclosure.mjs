#!/usr/bin/env node
/**
 * Imports one pool-service PoolCycleDisclosure into the Tidepool public site. Only the
 * disclosure.public view is persisted. The members view is intentionally discarded.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { appendReceivedDisclosure, projectPoolServiceDisclosure } from "../src/public-pool-projection.mjs";
import { PUBLIC_PROJECTION_PATH } from "../src/section-root.mjs";

const DEFAULT_OUTPUT=PUBLIC_PROJECTION_PATH;

/**
 * @param {{recordPath:string,operationReceipt:string,recordRef:string,importedAt:string,outputPath?:string}} args
 */
export async function importPoolDisclosure({ recordPath, operationReceipt, recordRef, importedAt, outputPath=DEFAULT_OUTPUT }) {
  const recordText=await readFile(recordPath,"utf8");
  const recordNi=`ni:///sha-256;${createHash("sha256").update(recordText,"utf8").digest("base64url")}`;
  const disclosure=JSON.parse(recordText);
  const received=projectPoolServiceDisclosure(disclosure,{operationReceipt,recordNi,recordRef,importedAt});
  let current;
  try {
    current=JSON.parse(await readFile(outputPath,"utf8"));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    current={$schema:"./schema/public-pool-projection.schema.json",type:"TidepoolPublicProjection",state:"unreceived",disclosures:[]};
  }
  const {projection,appended}=appendReceivedDisclosure(current,received);
  await mkdir(path.dirname(outputPath),{recursive:true});
  if (appended) await writeFile(outputPath,`${JSON.stringify(projection,null,2)}\n`,"utf8");
  return Object.freeze({imported:true,appended,outputPath,cycleId:received.public.cycle.cycleId,operationReceipt,recordNi});
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const {values}=parseArgs({options:{
    record:{type:"string"},
    "operation-receipt":{type:"string"},
    "record-ref":{type:"string"},
    "imported-at":{type:"string"},
    output:{type:"string"},
  }});
  if (!values.record || !values["operation-receipt"] || !values["record-ref"]) {
    process.stderr.write("usage: import-pool-disclosure.mjs --record PATH --operation-receipt ni:///sha-256/... --record-ref REF [--imported-at ISO] [--output PATH]\n");
    process.exitCode=2;
  } else {
    const result=await importPoolDisclosure({
      recordPath:values.record,
      operationReceipt:values["operation-receipt"],
      recordRef:values["record-ref"],
      importedAt:values["imported-at"] ?? new Date().toISOString(),
      outputPath:values.output,
    });
    process.stdout.write(`${JSON.stringify(result)}\n`);
  }
}
