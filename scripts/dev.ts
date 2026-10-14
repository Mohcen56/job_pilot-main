import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { workspaceRoot, webDirectory } from "../apps/api/src/paths";

async function main() {
  Object.assign(process.env, { NODE_ENV: "development" });
  await import("../apps/api/src/env");
  const { getPool, closePool } = await import("../apps/api/src/database/pool");
  try {
    await getPool().query("SELECT 1");
  } catch (error) {
    if (!process.env.DATABASE_URL) throw error;
    const database = new URL(process.env.DATABASE_URL || "");
    const isComposeDatabase = ["localhost", "127.0.0.1"].includes(database.hostname)
      && database.port === (process.env.POSTGRES_PORT || "15432")
      && database.pathname === "/jobhunt_ez" && database.username === "jobhunt";
    if (!isComposeDatabase) throw error;
    console.log("Starting the local PostgreSQL database...");
    const result = spawnSync("docker", ["compose", "up", "-d", "postgres"], {
      cwd: workspaceRoot, env: process.env, stdio: "inherit",
    });
    if (result.error || result.status !== 0) throw new Error("Start Docker Desktop, then run pnpm dev again.");
    let ready = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      try { await getPool().query("SELECT 1"); ready = true; break; }
      catch { await delay(1000); }
    }
    if (!ready) throw new Error("PostgreSQL did not become ready. Check docker compose logs postgres.");
  } finally {
    await closePool();
  }

  const requireFromRoot = createRequire(path.join(workspaceRoot, "package.json"));
  console.log("Database ready. Checking migrations...");
  const cli = requireFromRoot.resolve("tsx/cli");
  const apiDirectory = path.join(workspaceRoot, "apps/api");
  const migrate = spawnSync(process.execPath, [cli, "--tsconfig", "tsconfig.json", "src/database/migrate.ts"], {
    cwd: apiDirectory, env: process.env, stdio: "inherit",
  });
  if (migrate.error) throw migrate.error;
  if (migrate.status !== 0) throw new Error("Database migration failed; the app was not started.");

  console.log("Starting NestJS and Next.js together...");
  // Next loads generated page modules at runtime. Watching those modules would
  // restart the HTTP server whenever a page compiles or a Server Action runs.
  const ignoredDirectories = [webDirectory, path.join(workspaceRoot, ".verification"), path.join(workspaceRoot, "data")];
  const exclude = ignoredDirectories.flatMap((directory) => ["--exclude", `${directory.replaceAll("\\", "/")}/**`]);
  const server = spawn(process.execPath, [cli, "watch", "--clear-screen=false", ...exclude, "--tsconfig", "tsconfig.json", "src/main.ts"], {
    cwd: apiDirectory, env: process.env, stdio: "inherit",
  });
  server.on("error", (error) => { console.error(error.message); process.exitCode = 1; });
  server.on("exit", (code) => { process.exitCode = code ?? 0; });
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => { server.kill(signal); });
  }
}

main().catch((error: unknown) => {
  console.error("Development startup failed:", error instanceof Error ? error.message : "Check your configuration.");
  process.exitCode = 1;
});
