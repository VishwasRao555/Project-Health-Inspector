import "dotenv/config";
import { initSchema, isMysqlConfigured } from "./mysql";

/** Standalone schema bootstrap: `npm run db:init`. */
async function main(): Promise<void> {
  if (!isMysqlConfigured()) {
    console.error("DB_HOST / DB_USER / DB_NAME must be set to initialize MySQL.");
    process.exit(1);
  }
  await initSchema();
  console.log("[phi] MySQL schema is ready (users, password_resets, reports).");
  process.exit(0);
}

main().catch((err) => {
  console.error("[phi] schema init failed:", err);
  process.exit(1);
});
