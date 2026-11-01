// AC6 (S-007): cron routes and the PayHere notify route must never import
// from lib/ratelimit/ — they must not depend on Upstash.
//
// Each test reads the route file when it exists and fails if any line imports
// from @/lib/ratelimit or ../lib/ratelimit. When the route file does not exist
// yet the test is skipped automatically — it activates as soon as the route is
// created (S-002 for cron, S-064 for PayHere).

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

const ROOT = join(process.cwd());
const RATELIMIT_IMPORT = /from\s+['"](@\/lib\/ratelimit|\.\.\/.*lib\/ratelimit)/;

function readRoute(relPath: string): string | null {
  const abs = join(ROOT, relPath);
  return existsSync(abs) ? readFileSync(abs, "utf8") : null;
}

describe("AC6: lib/ratelimit not imported by exempt routes", () => {
  it.skipIf(!readRoute("app/api/cron/[job]/route.ts"))(
    "cron route does not import lib/ratelimit",
    () => {
      const src = readRoute("app/api/cron/[job]/route.ts")!;
      const hits = src
        .split("\n")
        .filter((line) => RATELIMIT_IMPORT.test(line));
      expect(hits).toHaveLength(0);
    }
  );

  it.skipIf(!readRoute("app/api/payhere/notify/route.ts"))(
    "PayHere notify route does not import lib/ratelimit",
    () => {
      const src = readRoute("app/api/payhere/notify/route.ts")!;
      const hits = src
        .split("\n")
        .filter((line) => RATELIMIT_IMPORT.test(line));
      expect(hits).toHaveLength(0);
    }
  );
});
