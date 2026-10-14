import { existsSync } from "node:fs";
import path from "node:path";

function findWorkspaceRoot() {
  let directory = process.cwd();
  while (!existsSync(path.join(directory, "pnpm-workspace.yaml"))) {
    const parent = path.dirname(directory);
    if (parent === directory) throw new Error("Run JobHunt EZ from its workspace.");
    directory = parent;
  }
  return directory;
}

// Works in the API, CLI commands and Next's generated PostCSS worker directory.
export const workspaceRoot = findWorkspaceRoot();
