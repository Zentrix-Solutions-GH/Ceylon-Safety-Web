// AC3 (S-022): Exported separately so the rule can be unit-tested without loading
// the full ESLint flat config (which pulls in next/core-web-vitals and FlatCompat).
export const noRawColorsRule = {
  meta: {
    type: "problem",
    messages: {
      found:
        "Raw colour '{{color}}' found. Use a CSS token class (e.g. text-primary, bg-success) instead.",
    },
  },
  create(context) {
    const HEX_COLOR = /#([0-9A-Fa-f]{8}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{4}|[0-9A-Fa-f]{3})\b/;
    const RGB_FUNC = /\brgb\s*\(\s*\d/;
    const HSL_FUNC = /\bhsl\s*\(\s*\d/;
    const ARBITRARY_COLOR = /\[#[0-9A-Fa-f]{3,8}\]/;

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
