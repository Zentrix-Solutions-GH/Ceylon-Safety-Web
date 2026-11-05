/**
 * AC1 / EC4 / EC5 — Verify design token contrast ratios.
 *
 * Parses the HSL values of `brand-red-text` and `focus-ring` directly
 * from globals.css so that renaming the token values causes the test to fail.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

// ── WCAG relative-luminance helpers ──────────────────────────────────────────

function linearize(c8bit: number): number {
  const s = c8bit / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(r: number, g: number, b: number): number {
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

function contrast(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Convert HSL (0-360, 0-100, 0-100) to sRGB 0-255 */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const sn = s / 100;
  const ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = ln - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

// ── Parse globals.css ─────────────────────────────────────────────────────────

const cssPath = path.resolve("app/globals.css");
const css = readFileSync(cssPath, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

/**
 * Extract the HSL triple for a CSS custom property like `--foo: H S% L%;`
 * Returns [hue, saturation, lightness] or null if not found.
 */
function extractHsl(varName: string): [number, number, number] | null {
  // Matches:  --varName: H S% L%;   (space-separated, percentages)
  const re = new RegExp(`--${varName}\\s*:\\s*(\\d+(?:\\.\\d+)?)\\s+(\\d+(?:\\.\\d+)?)%\\s+(\\d+(?:\\.\\d+)?)%`);
  const m = css.match(re);
  if (!m) return null;
  return [parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3])];
}

// ── Tests ─────────────────────────────────────────────────────────────────────

const WHITE_LUMINANCE = luminance(255, 255, 255);

describe("design tokens — contrast ratios", () => {
  it("brand-red-text token exists in globals.css (AC1)", () => {
    const hsl = extractHsl("brand-red-text");
    expect(hsl, "--brand-red-text not found in app/globals.css").not.toBeNull();
  });

  it("brand-red-text on white achieves ≥4.5:1 (AC1, EC4)", () => {
    const hsl = extractHsl("brand-red-text");
    if (!hsl) throw new Error("--brand-red-text not found — see 'token exists' test above");
    const [r, g, b] = hslToRgb(...hsl);
    const ratio = contrast(luminance(r, g, b), WHITE_LUMINANCE);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it("focus-ring token exists in globals.css (EC5)", () => {
    const hsl = extractHsl("focus-ring");
    expect(hsl, "--focus-ring not found in app/globals.css").not.toBeNull();
  });

  it("focus-ring on white achieves ≥3:1 (EC5)", () => {
    const hsl = extractHsl("focus-ring");
    if (!hsl) throw new Error("--focus-ring not found — see 'token exists' test above");
    const [r, g, b] = hslToRgb(...hsl);
    const ratio = contrast(luminance(r, g, b), WHITE_LUMINANCE);
    expect(ratio).toBeGreaterThanOrEqual(3);
  });

  it("success token exists in globals.css (AC1)", () => {
    expect(extractHsl("success"), "--success not found in app/globals.css").not.toBeNull();
  });

  it("warning token exists in globals.css (AC1)", () => {
    expect(extractHsl("warning"), "--warning not found in app/globals.css").not.toBeNull();
  });

  it("danger token exists in globals.css (AC1)", () => {
    expect(extractHsl("danger"), "--danger not found in app/globals.css").not.toBeNull();
  });

  it("logo-red token exists in globals.css (AC1)", () => {
    expect(extractHsl("logo-red"), "--logo-red not found in app/globals.css").not.toBeNull();
  });
});
