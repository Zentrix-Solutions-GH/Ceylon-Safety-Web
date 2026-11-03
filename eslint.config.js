import { FlatCompat } from "@eslint/eslintrc";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

// AC3 (S-022): flag raw colour codes in app/ and components/ so all colour
// usage goes through the CSS token classes defined in globals.css / tailwind.config.ts.
// global-error.tsx is exempted: it renders when the root layout itself fails and
// must use inline styles (cannot rely on CSS classes or Tailwind).
const noRawColorsRule = {
  meta: {
    type: "problem",
    messages: {
      found:
        "Raw colour '{{color}}' found. Use a CSS token class (e.g. text-primary, bg-success) instead.",
    },
  },
  create(context) {
    // Patterns that indicate a raw colour value in source code
    const HEX_COLOR = /#[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?([0-9A-Fa-f]{2})?\b/;
    const RGB_FUNC = /\brgb\s*\(\s*\d/;
    const HSL_FUNC = /\bhsl\s*\(\s*\d/;           // hsl(var(--x)) is safe; hsl(NNN …) is not
    const ARBITRARY_COLOR = /\[#[0-9A-Fa-f]{3,8}\]/; // Tailwind arbitrary e.g. bg-[#E30613]

    function report(node, match) {
      context.report({ node, messageId: "found", data: { color: match } });
    }

    function check(value, node) {
      for (const re of [HEX_COLOR, RGB_FUNC, HSL_FUNC, ARBITRARY_COLOR]) {
        const m = re.exec(value);
        if (m) { report(node, m[0]); break; }
      }
    }

    return {
      Literal(node) {
        if (typeof node.value === "string") check(node.value, node);
      },
      TemplateLiteral(node) {
        for (const quasi of node.quasis) check(quasi.value.raw, quasi);
      },
    };
  },
};

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
