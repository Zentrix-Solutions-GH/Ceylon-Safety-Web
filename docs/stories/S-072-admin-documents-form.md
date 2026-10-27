---
id: S-072
title: Admin documents list + form
status: ready
owner: frontend
risk: normal
branch: feature/S-072-admin-documents-form
pr: ~
depends_on: [S-045, S-069]
reqs: [REQ-133, REQ-134, REQ-042, REQ-060c, REQ-150]
---

## Goal

The admin screens to list documents and to create and edit a document record. Files, publishing and price changes are added in S-073. Size: about 1 day.

## Requirements covered

- REQ-133: Admin manages documents (CONFIRMED)
- REQ-134: Admin sets document prices (CONFIRMED; price is set on create here, changed in S-073)
- REQ-042, REQ-060c: Types, English title, one price (CONFIRMED)
- REQ-150: Only signed-in staff with the right permission open the panel (CONFIRMED)

## Acceptance criteria

- [ ] AC1: `/admin/documents` lists documents (`listDocuments`, S-069): title, type, category, price (LKR, two decimals), status, three marks EN, SI, TA (missing, uploading, ready, failed), preview mark, last changed. 25 per page, filters for status, type and category kept in the address, search by title.
- [ ] AC2: Empty list shows exactly "No documents yet. Add the first one." and the Add button.
- [ ] AC3: `/admin/documents/new` and `/admin/documents/[id]/edit` show the form from `saveDocument`: title (English, 200 characters), description, type, category (fixed list), page count (optional), preview pages (default 3), cover image (upload with `useMediaUpload`/`ImageUploadField` from S-055), price (new document only; on edit it is shown read-only with the note "Change the price from the document page" until S-073 adds the button).
- [ ] AC4: Price field accepts whole LKR above 0 only and shows the value with the currency; the screen never sends cents the user did not type.
- [ ] AC5: The form checks the shared schema on blur and submit, shows errors under the field linked for screen readers, disables the button while saving ("Saving...") and moves focus to the first error.
- [ ] AC6: `version_conflict` shows "Someone else changed this while you were editing. Reload to see their changes. Your text is kept."
- [ ] AC7: `not_allowed` shows "You do not have permission to do this." A user without `documents.*` never sees the Documents menu item (S-045) and gets the normal "not found" page by address.
- [ ] AC8: A new, unpublished document is saved as a draft; the screen states that it is not visible to visitors until files are uploaded and it is published (S-073).
- [ ] AC9: Admin screens are no-store and `noindex`; the page works with keyboard only.

## Edge cases

- [ ] EC1: Two admins edit the same document: the second save shows the conflict message and keeps the typed text.
- [ ] EC2: Title over 200 characters or only spaces: inline error before any request.
- [ ] EC3: Cover image upload fails: `upload_failed` message "The upload did not finish. Try again." and the form keeps its other values.
- [ ] EC4: Session window passed: `reauth_required` message "For safety, please sign in again." and the typed text stays in the browser.
- [ ] EC5: A rejected price such as 12.5 or 0 shows an inline error.
- [ ] EC6: Table on a narrow screen scrolls sideways inside its own box; the page does not.

## Contract

Types consumed (read-only, S-069): `AdminDocumentRow`, `AdminDocument`, `SaveDocumentInput` in `types/document.ts`. No type changes.

## Out of scope

- Language file and preview uploads, publish and hide, price change (S-073).
- Document delete (not offered, admin panel 6.4).
- Phone layout for admin (admin is desktop-first, below 1024 px a note is shown by the shell).

## Assumptions accepted

- Admin screen conventions: 25 per page, filters in the address, short confirmations (admin panel 12).
- Price read-only on edit until S-073 is the story split chosen in the roster, not a spec rule.

## Test plan

| Test | Type | File |
|---|---|---|
| AC1, AC2 list rendering and empty state | component | `components/admin/__tests__/DocumentsTable.test.tsx` |
| AC3, AC4 form fields and price rules | component | `components/admin/__tests__/DocumentForm.test.tsx` |
| AC5, EC2, EC5 validation and focus | component | `components/admin/__tests__/DocumentForm.test.tsx` |
| AC6, EC1 conflict message keeps text | component | `components/admin/__tests__/DocumentForm.test.tsx` |
| AC7 permission message and hidden menu | component | `components/admin/__tests__/DocumentForm.test.tsx` |
| EC3, EC4 upload and session errors | component | `components/admin/__tests__/DocumentForm.test.tsx` |
| Create then edit a document end to end | e2e (Playwright, local Supabase) | `e2e/admin-documents.spec.ts` |
| AC9 axe on list and form | e2e | `e2e/admin-documents.spec.ts` |

## Plan

<!-- Filled in by /story-run at Step 3. Do not edit manually. -->
Prior art: read in full `admin-panel-design` sections 3.3, 6.1, 6.2, 12, 17 and 18; `file-structure` (`app/admin/documents/`, `components/admin/`); `frontend-architecture` sections 7.2, 8.1. Consumes S-069; extends S-045 (admin shell); supersedes nothing.

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges, a user can:

- Sign in as an Admin, open Documents, see the list, add a document draft with a price and cover image, and edit its details.

## After this merges, these still do NOT work:

- No file uploads, no publish, no price change (S-073).
- Visitors still cannot see any document.
- Follow-up: S-073.
