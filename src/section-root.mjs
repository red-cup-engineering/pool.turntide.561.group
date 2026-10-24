/**
 * Where this engine finds its parameters. The Public section that parameterizes it
 * (causeway-services/public-tidepool-services-section) holds tidepool.json, the public pool
 * projection and the schemas. TIDEPOOL_SECTION_ROOT names that checkout; unset, the root is
 * the monorepo layout where this engine is mounted at <section>/sites/pool.turntide.561.group.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

export const SITE_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const SECTION_ROOT = process.env.TIDEPOOL_SECTION_ROOT
  ? path.resolve(process.env.TIDEPOOL_SECTION_ROOT)
  : path.resolve(SITE_ROOT, "../..");
export const PARAMETERS_PATH = path.join(SECTION_ROOT, "tidepool.json");
export const PUBLIC_PROJECTION_PATH = path.join(SECTION_ROOT, "data", "records", "public-pool-projection.json");
