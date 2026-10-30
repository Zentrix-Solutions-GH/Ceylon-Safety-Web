import { execSync } from 'child_process';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { describe, test, expect, beforeEach, afterEach } from 'vitest';

const SCRIPT = join(process.cwd(), 'scripts/check-no-mocks.sh');
const TMP = join(process.cwd(), '__tests__/.tmp-no-mocks');

function run(dir: string): { ok: boolean; output: string } {
  try {
    const output = execSync(`bash "${SCRIPT}"`, {
      cwd: dir,
      stdio: 'pipe',
    }).toString();
    return { ok: true, output };
  } catch (e: unknown) {
    const err = e as { stdout?: Buffer; stderr?: Buffer };
    return {
      ok: false,
      output: (err.stdout?.toString() ?? '') + (err.stderr?.toString() ?? ''),
    };
  }
}

beforeEach(() => {
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(join(TMP, 'lib'), { recursive: true });
  mkdirSync(join(TMP, '__tests__'), { recursive: true });
  mkdirSync(join(TMP, '__mocks__'), { recursive: true });
});

afterEach(() => {
  rmSync(TMP, { recursive: true, force: true });
});

describe('check-no-mocks.sh — AC5', () => {
  test('passes when no files exist', () => {
    const { ok } = run(TMP);
    expect(ok).toBe(true);
  });

  test('passes when only test files import from mocks/', () => {
    writeFileSync(
      join(TMP, '__tests__/foo.test.ts'),
      `import { bar } from '__mocks__/bar';\n`,
    );
    const { ok } = run(TMP);
    expect(ok).toBe(true);
  });

  test('passes when only __mocks__ itself imports from mocks/', () => {
    writeFileSync(
      join(TMP, '__mocks__/db.ts'),
      `import { x } from 'mocks/x';\n`,
    );
    const { ok } = run(TMP);
    expect(ok).toBe(true);
  });

  test('fails when a production lib file imports from mocks/', () => {
    writeFileSync(
      join(TMP, 'lib/bad.ts'),
      `import { fake } from 'mocks/fake-db';\n`,
    );
    const { ok, output } = run(TMP);
    expect(ok).toBe(false);
    expect(output).toMatch(/mocks\//);
  });

  test('fails when a production file uses double-quoted mocks import', () => {
    writeFileSync(
      join(TMP, 'lib/bad2.ts'),
      `import { x } from "mocks/x";\n`,
    );
    const { ok } = run(TMP);
    expect(ok).toBe(false);
  });

  test('passes when a production file imports something that contains the word mocks elsewhere', () => {
    writeFileSync(
      join(TMP, 'lib/ok.ts'),
      `import { x } from './real-module';\n// no mocks here\n`,
    );
    const { ok } = run(TMP);
    expect(ok).toBe(true);
  });
});
