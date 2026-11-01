## Summary

<!-- What does this PR do? One paragraph. -->

## Story link and REQ ids

Story: `docs/stories/S-XXX-title.md`
REQ ids: REQ-XXX, REQ-XXX (or "infrastructure — no REQ id")

## After this merges, a user can:

<!-- One or more concrete, observable actions. -->

## After this merges, these still do NOT work:

<!-- Everything a reader might assume this enables, but which it does not. -->

## Test evidence

<!-- Paste scripts/check.sh output and any manual evidence. -->

```
$ bash scripts/check.sh
```

## Security (sensitive stories only)

- [ ] Security review passed (paste reviewer verdict or "N/A — not a sensitive story")

## Checklist

- [ ] Story file updated (status, evidence, review notes)
- [ ] Tests added for every acceptance criterion and edge case
- [ ] No hardcoded configuration (URLs, keys, IDs — everything via `lib/config.ts`)
- [ ] No secrets in code or logs
- [ ] `scripts/check.sh` green (paste output above)

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
