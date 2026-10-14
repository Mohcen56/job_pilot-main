import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["apps/api/src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [{
        group: ["@/*", "@jobhunt/web/*", "**/apps/web/**"],
        message: "API code must use relative imports and cannot depend on the frontend.",
      }] }],
    },
  },
  {
    files: ["packages/shared/src/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [{
        group: ["@jobhunt/api/*", "@jobhunt/web/*", "next", "next/*", "react", "@nestjs/*", "pg", "node:*"],
        message: "Shared contracts and pure helpers cannot depend on apps or server frameworks.",
      }] }],
    },
  },
  {
    files: ["apps/web/src/components/**/*.tsx"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [{
        group: ["@jobhunt/api/*"],
        message: "UI components use actions or shared contracts; API services stay in server adapters.",
      }] }],
    },
  },
  {
    files: ["tests/**/*.cjs"],
    // The dependency-free Node test harness uses CommonJS to load transpiled app modules.
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  { settings: { next: { rootDir: "apps/web/" } } },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    "**/.next/**",
    ".verification/**",
    "out/**",
    "build/**",
    "**/next-env.d.ts",
  ]),
]);

export default eslintConfig;
