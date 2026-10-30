// @vitest-environment node
// AC3 — verifies the four branded email templates exist and each contains
// {{ .Token }} so Supabase injects the real code.
// These are file-content checks; no local stack is required.

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const templatesDir = path.resolve(__dirname, "../../supabase/templates");

const REQUIRED_TEMPLATES = [
  { file: "confirm-signup.html", label: "confirm sign-up" },
  { file: "reset-password.html", label: "reset password" },
  { file: "reauthentication.html", label: "reauthentication" },
  { file: "magic-link.html", label: "magic link / re-verification" },
];

describe("S-031 AC3: email templates — existence and token placeholder", () => {
  for (const { file, label } of REQUIRED_TEMPLATES) {
    it(`${label} template file exists`, () => {
      const full = path.join(templatesDir, file);
      expect(fs.existsSync(full), `${full} must exist`).toBe(true);
    });

    it(`${label} template contains {{ .Token }}`, () => {
      const full = path.join(templatesDir, file);
      if (!fs.existsSync(full)) return; // Skip if file missing (caught above)
      const content = fs.readFileSync(full, "utf8");
      expect(content).toContain("{{ .Token }}");
    });

    it(`${label} template is valid HTML (has <html> tag)`, () => {
      const full = path.join(templatesDir, file);
      if (!fs.existsSync(full)) return;
      const content = fs.readFileSync(full, "utf8");
      expect(content).toMatch(/<html/i);
    });

    it(`${label} template does not contain placeholder text`, () => {
      const full = path.join(templatesDir, file);
      if (!fs.existsSync(full)) return;
      const content = fs.readFileSync(full, "utf8");
      expect(content).not.toContain("TODO");
      expect(content).not.toContain("PLACEHOLDER");
    });
  }

  it("templates directory exists at supabase/templates/", () => {
    expect(fs.existsSync(templatesDir), `${templatesDir} must exist`).toBe(
      true
    );
  });

  it("magic-link template note: site never offers magic-link sign-in (comment present)", () => {
    const full = path.join(templatesDir, "magic-link.html");
    if (!fs.existsSync(full)) return;
    const content = fs.readFileSync(full, "utf8");
    // The template must carry a comment that it is used for re-verification, not sign-in
    expect(content).toMatch(/re-?verification|reauthenticat/i);
  });
});

describe("S-031 AC3: config.toml wires template paths", () => {
  it("config.toml references confirm-signup template", () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../../supabase/config.toml"),
      "utf8"
    );
    expect(src).toContain("confirm-signup");
  });

  it("config.toml references reset-password template", () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../../supabase/config.toml"),
      "utf8"
    );
    expect(src).toContain("reset-password");
  });
});
