import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

function collectTsFiles(dir: string): string[] {
  let files: string[] = [];
  let entries: ReturnType<typeof readdirSync>;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "__tests__" && entry.name !== "node_modules") {
        files = files.concat(collectTsFiles(full));
      }
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

const ROOT = process.cwd();

// Files that are not allowed to call server session APIs.
// Public pages stay cached only if the server never reads the session cookie.
const DIRS_TO_SCAN = [
  join(ROOT, "app/(public)"),
  join(ROOT, "components/layout"),
];

// Patterns that indicate a server-side session read.
const FORBIDDEN: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /from\s+['"]next\/headers['"]/, label: "imports from next/headers" },
  { pattern: /from\s+['"][^'"]*lib\/supabase\/server['"]/, label: "imports server Supabase client" },
  { pattern: /createServerClient\b/, label: "calls createServerClient" },
];

describe("no-server-session-in-public", () => {
  it("AC2: no file in app/(public)/ or components/layout/ uses server session APIs", () => {
    const violations: string[] = [];
    for (const dir of DIRS_TO_SCAN) {
      for (const file of collectTsFiles(dir)) {
        const content = readFileSync(file, "utf-8");
        for (const { pattern, label } of FORBIDDEN) {
          if (pattern.test(content)) {
            violations.push(`${file}: ${label}`);
          }
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
