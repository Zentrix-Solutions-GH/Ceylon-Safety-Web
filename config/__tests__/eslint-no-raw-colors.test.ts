// AC3 (S-022): Verify the no-raw-colors ESLint rule catches violations.
// This is the negative test the story required; it proves the rule fires, not just
// that the current codebase has no violations.
import { describe, it } from "vitest";
import { RuleTester } from "eslint";
import { noRawColorsRule } from "../eslint-no-raw-colors-rule.js";

describe("no-raw-colors ESLint rule (AC3, S-022)", () => {
  it("flags raw colours and passes token class names", () => {
    const tester = new RuleTester({ languageOptions: { ecmaVersion: 2022 } });
    tester.run("no-raw-colors", noRawColorsRule as never, {
      valid: [
        { code: 'const c = "text-primary"' },
        { code: 'const c = "bg-success"' },
        { code: 'const c = "hsl(var(--primary))"' },
        { code: 'const c = `${prefix}-text-primary`' },
        { code: 'const c = "#not-a-color"' },        // # + non-hex char → no match
        { code: 'const c = "rgba(var(--ring), 0.5)"' },
      ],
      invalid: [
        { code: 'const c = "#E30613"', errors: [{ messageId: "found" }] },
        { code: 'const c = "#abc"', errors: [{ messageId: "found" }] },
        { code: 'const c = "#AABBCCDD"', errors: [{ messageId: "found" }] },
        { code: 'const c = "rgb(255, 0, 0)"', errors: [{ messageId: "found" }] },
        { code: 'const c = "rgba(255, 0, 0, 0.5)"', errors: [{ messageId: "found" }] },
        { code: 'const c = "hsl(357 95% 46%)"', errors: [{ messageId: "found" }] },
        { code: 'const c = "hsla(357, 95%, 46%, 1)"', errors: [{ messageId: "found" }] },
        { code: 'const c = `bg-[#E30613]`', errors: [{ messageId: "found" }] },
      ],
    });
  });
});
