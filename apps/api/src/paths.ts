import path from "node:path";
import { workspaceRoot } from "../../../scripts/workspace.mjs";

export { workspaceRoot };
export const webDirectory = path.join(workspaceRoot, "apps/web");
export const migrationDirectory = path.join(workspaceRoot, "apps/api/src/database/migrations");
