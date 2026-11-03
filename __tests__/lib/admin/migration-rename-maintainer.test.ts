// S-039: Structural verification of the rename_maintainer_to_editor migration.
// These tests run without a live Supabase stack. They parse the SQL file to
// assert the critical invariants that the pgTAP suite would verify at runtime.

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const MIGRATION_PATH = join(
  process.cwd(),
  "supabase/migrations/20261103000001_rename_maintainer_to_editor.sql"
);

let sql: string;

beforeAll(() => {
  sql = readFileSync(MIGRATION_PATH, "utf8");
});

describe("Migration 20261103000001 — rename maintainer → editor", () => {
  // ── CHECK constraints ──────────────────────────────────────────────────────

  it("user_roles CHECK constraint includes 'editor'", () => {
    // Confirm the new constraint allows the renamed role.
    expect(sql).toContain("'super_admin', 'admin', 'editor'");
  });

  it("user_roles CHECK constraint does NOT include 'maintainer'", () => {
    // 'maintainer' must be absent from every CHECK clause.
    const checkClauses = sql.match(/CHECK\s*\([^)]+\)/gi) ?? [];
    for (const clause of checkClauses) {
      expect(clause).not.toContain("'maintainer'");
    }
  });

  it("role_permissions CHECK constraint includes 'editor' (not 'maintainer')", () => {
    expect(sql).toContain("role_permissions_role_check");
    expect(sql).toContain("CHECK (role IN ('super_admin', 'admin', 'editor'))");
  });

  // ── Data migration ─────────────────────────────────────────────────────────

  it("data migration updates user_roles rows from maintainer to editor", () => {
    expect(sql).toMatch(/UPDATE\s+public\.user_roles\s+SET\s+role\s*=\s*'editor'\s+WHERE\s+role\s*=\s*'maintainer'/i);
  });

  it("data migration updates role_permissions rows from maintainer to editor", () => {
    expect(sql).toMatch(/UPDATE\s+public\.role_permissions\s+SET\s+role\s*=\s*'editor'\s+WHERE\s+role\s*=\s*'maintainer'/i);
  });

  // ── Editor permission seed ─────────────────────────────────────────────────

  it("seeds exactly 15 editor permission rows (admin minus users.*, settings.site)", () => {
    const editorInserts = (sql.match(/\('editor',\s*'[^']+'\)/g) ?? []);
    expect(editorInserts).toHaveLength(15);
  });

  it("editor seed excludes users.read", () => {
    expect(sql).not.toMatch(/\('editor',\s*'users\.read'\)/);
  });

  it("editor seed excludes users.suspend", () => {
    expect(sql).not.toMatch(/\('editor',\s*'users\.suspend'\)/);
  });

  it("editor seed excludes settings.site", () => {
    expect(sql).not.toMatch(/\('editor',\s*'settings\.site'\)/);
  });

  // ── access_token_hook ──────────────────────────────────────────────────────

  it("custom_access_token_hook no longer hard-codes 'maintainer'", () => {
    // The hook should emit whatever role is in the DB row — no hard-coded string.
    const hookBody = sql.slice(
      sql.indexOf("CREATE OR REPLACE FUNCTION private.custom_access_token_hook"),
      sql.indexOf("$$;", sql.indexOf("CREATE OR REPLACE FUNCTION")) + 3
    );
    expect(hookBody).not.toContain("'maintainer'");
  });

  // ── Audit log ─────────────────────────────────────────────────────────────

  it("admin_audit_log CHECK constraint includes 'user.remove_mfa'", () => {
    expect(sql).toContain("'user.remove_mfa'");
  });

  // ── Transaction safety ─────────────────────────────────────────────────────

  it("migration is wrapped in BEGIN / COMMIT", () => {
    // File starts with comments; BEGIN must appear before any DML.
    expect(sql).toMatch(/BEGIN\s*;/i);
    expect(sql.trimEnd()).toMatch(/COMMIT\s*;\s*$/i);
  });
});
