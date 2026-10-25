---
id: S-057
title: Editor save flow — metadata, local backup, publish gating
status: ready
owner: frontend
risk: normal
branch: feature/S-057-editor-save-flow
pr: ~
depends_on: [S-048, S-055]
reqs: [REQ-034, REQ-026, REQ-027]
---

## Goal

Complete the `ArticleEditor` shell: manual Save, metadata fields (title, slug, category, author, excerpt, cover image, publish time), a local draft backup in the admin's browser, version-conflict detection, and the publish-gating check that enforces all required fields before allowing publishing. The editor is the only place admins write articles (REQ-026).

## Requirements covered

- REQ-026: Only admins add and edit articles
- REQ-027: Admin can set title, category, author, cover image, excerpt, and publish time
- REQ-034: Manual Save; leave-page warning; local backup in browser

## Acceptance criteria

- [ ] AC1: Clicking "Save draft" calls `saveArticle` (server action from S-048); a success toast shows "Saved"; a version-conflict (HTTP 409) shows "Someone else changed this article. Reload to see their version. Your text is kept in this browser."
- [ ] AC2: After a successful save, the local backup for this article id is cleared from `localStorage`
- [ ] AC3: On load, if a `localStorage` backup exists that is newer than the server version, a banner asks "You have unsaved changes from [date]. Restore?" with Restore / Discard buttons
- [ ] AC4: Navigating away with unsaved changes triggers the browser's native leave-page warning (`beforeunload`)
- [ ] AC5: The "Publish" button is disabled and shows an inline list of exactly what is missing when any of the following are absent: title, slug, category, active author, cover image (with alt text, `media.status === 'ready'`), excerpt, publish time
- [ ] AC6: The publish-time picker is labelled "Sri Lanka time (Asia/Colombo)" and shows "Will go live on [formatted date/time]" beneath it; a time less than 1 minute in the future shows a warning "This will publish almost immediately"
- [ ] AC7: Slug is auto-generated from the title on first keystroke; admin can override it; slug is locked once the article is first published (no edit field shown after first publish)
- [ ] AC8: Saving never changes the article's status (draft stays draft; hidden stays hidden)

## Edge cases

- [ ] EC1: Two admins edit the same article simultaneously — the second save returns 409; the local backup preserves the second admin's work
- [ ] EC2: `localStorage` throws (private browsing, quota exceeded) — local backup silently disabled; everything else still works
- [ ] EC3: Slug clashes with a reserved word (admin, api, search, new, edit, preview, sign-in) — inline error "This slug is reserved. Please change it."
- [ ] EC4: Deactivated author chosen — publish button shows "Author is deactivated. Please pick an active author."
- [ ] EC5: Cover image is in `pending` state (upload not confirmed) — publish blocked with "Cover image upload is not complete"

## Contract

Types added or changed in `types/` by this story (for contract-checker agent):
- `types/article.ts`: `ArticleSavePayload`, `ArticleMetadata` (title, slug, category, authorId, excerpt, coverMediaId, scheduledAt)

## Out of scope

- Article status actions (publish, hide, delete) are not in this story; they are in S-048 backend and wired to UI buttons here only as pass-through calls
- Article preview page (S-058)
- Revision history (not in v1, content design section 4.6)

## Assumptions accepted

- N8: No server autosave in v1; local backup only
- N1: Slug locked after first publish
- One backup per article id + body_version stored in localStorage; key pattern `cs-draft-<articleId>`

## Test plan

| Test | Type | File |
|---|---|---|
| Save calls saveArticle and clears local backup on success | unit | `__tests__/components/admin/ArticleEditor/index.test.tsx` |
| Version conflict (409) preserves local backup | unit | `__tests__/components/admin/ArticleEditor/index.test.tsx` |
| Restore banner shown when backup is newer | unit | `__tests__/components/admin/ArticleEditor/index.test.tsx` |
| Publish blocked when title missing | unit | `__tests__/components/admin/ArticleEditor/index.test.tsx` |
| Publish blocked when cover image pending | unit | `__tests__/components/admin/ArticleEditor/index.test.tsx` |
| Slug auto-generated from title | unit | `__tests__/lib/content/slug.test.ts` |
| Reserved slug rejected | unit | `__tests__/lib/content/slug.test.ts` |
| localStorage failure → backup silently skipped | unit | `__tests__/components/admin/ArticleEditor/index.test.tsx` |

## Plan

Prior art: `grep -ril "save.*draft\|local.*backup\|version.*conflict\|body_version" docs/` → content design sections 4.4, 4.6, 5.2. File-structure: `components/admin/ArticleEditor/index.tsx`, `PublishTimePicker.tsx`. S-048 defines `saveArticle` server action.

<!-- Filled in by /story-run at Step 3. Do not edit manually. -->

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges

- S-058 (admin articles list) can be built; the full editor flow is now complete
