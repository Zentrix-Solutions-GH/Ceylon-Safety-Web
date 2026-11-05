import { FlatCompat } from "@eslint/eslintrc";
import path from "path";
import { fileURLToPath } from "url";
import { noRawColorsRule } from "./config/eslint-no-raw-colors-rule.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const config = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  { ignores: [".next/**", ".worktrees/**", ".claude/**", "node_modules/**", "coverage/**", "next-env.d.ts"] },
  // Raw-colour rule: scoped to app/ and components/ source files only
  {
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
    ignores: [
      "app/global-error.tsx",   // intentionally uses inline styles (root-layout fallback)
      "app/(dev)/**",           // dev-only pages may use test values
    ],
    plugins: { local: { rules: { "no-raw-colors": noRawColorsRule } } },
    rules: { "local/no-raw-colors": "error" },
  },
];

export default config;
