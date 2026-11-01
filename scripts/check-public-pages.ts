#!/usr/bin/env tsx
/**
 * AC11: Fail the build if any file in app/(public) imports cookies, headers,
 * or reads auth sessions — public pages must never call getCurrentUser().
 *
 * Run: npx tsx scripts/check-public-pages.ts
 */
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

const PUBLIC_DIR = join(process.cwd(), "app", "(public)");

const BANNED_PATTERNS = [
  /\bcookies\(\)/,
  /\bheaders\(\)/,
  /from\s+['"]next\/headers['"]/,
  /\bgetCurrentUser\(\)/,
  /from\("@\/lib\/auth\/server"\)/,
  /require\("@\/lib\/auth\/server"\)/,
  /import.*from.*["']@\/lib\/auth\/server["']/,
  /\bauth\.getUser\b/,
  /\bauth\.getSession\b/,
];

function walk(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...walk(full));
    } else if (/\.(tsx?|jsx?)$/.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

const violations: { file: string; line: number; text: string }[] = [];

let files: string[];
try {
  files = walk(PUBLIC_DIR);
} catch {
  // app/(public) may not exist yet — not a failure
  console.log("check-public-pages: app/(public) not found, skipping.");
  process.exit(0);
}

for (const file of files) {
  const lines = readFileSync(file, "utf8").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pattern of BANNED_PATTERNS) {
      if (pattern.test(line)) {
        violations.push({ file, line: i + 1, text: line.trim() });
      }
    }
  }
}

if (violations.length > 0) {
  console.error(
    "check-public-pages: found auth/cookie reads in public pages — public pages must never call getCurrentUser() or read cookies."
  );
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  ${v.text}`);
  }
  process.exit(1);
}

console.log(`check-public-pages: OK — checked ${files.length} file(s), no violations.`);
