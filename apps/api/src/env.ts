import { loadEnvConfig } from "@next/env";

// Exactly the same .env/.env.local precedence as the Next.js frontend.
import { workspaceRoot } from "./paths";

// Watch children inherit Next's processed-env marker from the launcher.
// Reload files explicitly so newly added settings are picked up on restart.
loadEnvConfig(workspaceRoot, process.env.NODE_ENV !== "production", console, true);
