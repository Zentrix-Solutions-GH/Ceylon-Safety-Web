---
name: status
description: >
  Show current project status: active stories, recent PRs, CI state, and
  any blocked items. Quick read-only overview — no changes made.
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
---

# Project Status — CeylonSafety

Show a live snapshot of the project.

## Usage

```
/status
```

## Steps

1. List all story files and their status fields:
   ```bash
   grep -h "^status:" docs/stories/S-*.md 2>/dev/null || echo "No stories yet"
   ```

2. Show recent git activity:
   ```bash
   git log --oneline -10
   git branch -a | grep feature/
   ```

3. Show open PRs:
   ```bash
   gh pr list --base dev --json number,title,state,headRefName 2>/dev/null || echo "gh not configured"
   ```

4. Show last CI run (if GitHub CLI configured):
   ```bash
   gh run list --limit 5 2>/dev/null || echo "No CI runs yet"
   ```

5. List blocked stories:
   ```bash
   grep -l "^status: blocked" docs/stories/S-*.md 2>/dev/null
   ```

## Output format

```
## CeylonSafety — Project Status

### Stories
| ID | Title | Status | Branch |
|---|---|---|---|

### Open PRs
| # | Title | Status |
|---|---|---|

### Recent CI
| Run | Status | Branch |
|---|---|---|

### Blocked items
- [story ID] — [reason from story file]
```
