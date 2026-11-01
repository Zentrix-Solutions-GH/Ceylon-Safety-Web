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
  join(ROOT, "hooks"),
];

// Patterns that indicate a server-side session read.
const FORBIDDEN: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /from\s+['"]next\/headers['"]/, label: "imports from next/headers" },
  { pattern: /from\s+['"][^'"]*lib\/supabase\/server['"]/, label: "imports server Supabase client" },
  { pattern: /createServerClient\b/, label: "calls createServerClient" },
  // Direct call-site checks (defence-in-depth: catches calls via re-export barrels
  // where the import line may not reference next/headers directly).
  // Strip single-line comments before matching so comment-only mentions are ignored.
  { pattern: /(?<!\/\/.*)\bcookies\s*\(\s*\)/, label: "calls cookies() directly" },
  { pattern: /(?<!\/\/.*)\bheaders\s*\(\s*\)/, label: "calls headers() directly" },
];

describe("no-server-session-in-public", () => {
  it("AC2: no file in app/(public)/, components/layout/, or hooks/ uses server session APIs", () => {
    const violations: string[] = [];
    for (const dir of DIRS_TO_SCAN) {
      for (const file of collectTsFiles(dir)) {
        const raw = readFileSync(file, "utf-8");
        // Strip single-line comments before scanning so patterns in comments
        // like "// never calls cookies()" don't produce false positives.
        const content = raw.replace(/\/\/[^\n]*/g, "");
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
