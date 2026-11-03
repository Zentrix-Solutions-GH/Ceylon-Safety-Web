// S-039 EC2: Editor permissions exclude users.read, users.suspend, settings.site.
// This test guards against accidental widening of the editor permission set.

import { describe, it, expect } from "vitest";
import { PERMISSION_MAP } from "@/lib/auth/permissions";

describe("Editor permission set (EC2, Q63 confirmed 2026-11-03)", () => {
  const editorPerms = PERMISSION_MAP.editor;

  it("EC2: editor cannot access users.read", () => {
    expect(editorPerms).not.toContain("users.read");
  });

  it("EC2: editor cannot access users.suspend", () => {
    expect(editorPerms).not.toContain("users.suspend");
  });

  it("EC2: editor cannot access settings.site", () => {
    expect(editorPerms).not.toContain("settings.site");
  });

  it("EC2: editor has all other admin permissions (15 rows)", () => {
    expect(editorPerms).toHaveLength(15);
  });

  it("EC2: admin has all 18 permissions including the three excluded from editor", () => {
    const adminPerms = PERMISSION_MAP.admin;
    expect(adminPerms).toContain("users.read");
    expect(adminPerms).toContain("users.suspend");
    expect(adminPerms).toContain("settings.site");
    expect(adminPerms).toHaveLength(18);
  });
});
