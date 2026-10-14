import "../env";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { migrationDirectory } from "../paths";
import { closePool, getPool } from "./pool";

async function migrate() {
  const client = await getPool().connect();
  try {
    await client.query("SELECT pg_advisory_lock(83001421)");
    await client.query("CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
    const directory = migrationDirectory;
    for (const name of (await readdir(directory)).filter((file) => file.endsWith(".sql")).sort()) {
      if ((await client.query("SELECT 1 FROM schema_migrations WHERE name=$1", [name])).rowCount) continue;
      await client.query("BEGIN");
      try {
        await client.query(await readFile(path.join(directory, name), "utf8"));
        await client.query("INSERT INTO schema_migrations(name) VALUES($1)", [name]);
        await client.query("COMMIT");
        console.log("Applied", name);
      } catch (error) { await client.query("ROLLBACK"); throw error; }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock(83001421)");
    client.release();
    await closePool();
  }
}
migrate().catch(() => { console.error("Migration failed. Check DATABASE_URL and database access."); process.exitCode = 1; });
