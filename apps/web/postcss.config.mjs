import path from "node:path";
import { workspaceRoot } from "../../scripts/workspace.mjs";

const config = {
  plugins: {
    tailwindcss: { config: path.join(workspaceRoot, "apps/web/tailwind.config.cjs") },
    autoprefixer: {},
  },
};
export default config;
