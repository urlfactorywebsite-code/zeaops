import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  { settings: { next: { rootDir: "apps/web/" }, react: { version: "19.3.1" } } },
  globalIgnores([
    "**/.next/**",
    "**/next-env.d.ts",
    "**/.venv/**",
    "**/playwright-report/**",
    "**/test-results/**",
  ]),
]);
