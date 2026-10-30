import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { describe, test, expect } from 'vitest';

const WORKFLOWS_DIR = join(process.cwd(), '.github/workflows');

describe('GitHub Actions workflow files — AC2', () => {
  const files = readdirSync(WORKFLOWS_DIR).filter(
    (f) => f.endsWith('.yml') || f.endsWith('.yaml'),
  );

  test('at least one workflow file exists', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  test.each(files)(
    '%s: every uses: line is pinned to a full 40-char commit SHA',
    (file) => {
      const content = readFileSync(join(WORKFLOWS_DIR, file), 'utf8');
      const usesLines = content
        .split('\n')
        .filter((l) => /^\s+uses:\s+/.test(l));

      for (const line of usesLines) {
        expect(
          line,
          `${file}: unpinned action found: ${line.trim()}`,
        ).toMatch(/@[0-9a-f]{40}/);
      }
    },
  );
});
