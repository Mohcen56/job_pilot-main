import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { webDirectory } from "../apps/api/src/paths";

async function build() {
  Object.assign(process.env, { NODE_ENV: "production" });
  await import("../apps/api/src/env");
  const requireFromWeb = createRequire(`${webDirectory}/package.json`);
  const result = spawnSync(process.execPath, [requireFromWeb.resolve("next/dist/bin/next"), "build", webDirectory], {
    cwd: webDirectory, env: process.env, stdio: "inherit",
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}

build().catch((error: unknown) => {
  console.error("Build failed:", error instanceof Error ? error.message : "Check the build configuration.");
  process.exitCode = 1;
});
