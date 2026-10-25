---
id: S-069
title: Documents admin backend: CRUD + prices
status: ready
owner: backend
risk: sensitive
branch: feature/S-069-documents-admin-backend
pr: ~
depends_on: [S-015, S-038]
reqs: [REQ-133, REQ-134, REQ-042, REQ-043, REQ-056, REQ-060c]
---

## Goal

The admin actions that create and edit a document record (title, type, category, cover, price) and change its price safely. Files and publishing are in S-070. Size: about 1 day.

## Requirements covered

- REQ-133: Admin uploads and manages documents, including language versions (CONFIRMED; files in S-070)
- REQ-134: Admin sets document prices (CONFIRMED)
- REQ-056: Admin sets document prices (coupons are Release 2) (CONFIRMED)
- REQ-042: Types are Checklists, Safety Signs, Toolbox Talks (CONFIRMED; the full list is Q69, accepted below)
- REQ-043: Only PowerPoint is sold (CONFIRMED)
- REQ-060c: One document, one price for all languages, English title and description (CONFIRMED)

## Acceptance criteria

- [ ] AC1: `listDocuments({ status, type, category, search, page })` returns 25 rows per page with: title, `doc_kind`, category, price, status, language-file marks (en, si, ta: missing, uploading, ready, failed), preview mark, last changed. Needs `documents.*` (Admin seeded; Super Admin passes; Maintainer refused with `not_allowed`).
- [ ] AC2: `getDocument(id)` returns one document with the same marks. `not_found` for an unknown id.
- [ ] AC3: `saveDocument(fields, updatedAt)` creates or edits: title (English, up to 200 characters), description, type (`checklist`, `safety_sign`, `toolbox_talk`), category (from the fixed list), page count (optional), preview pages (default 3), cover image key (from `media.upload`, S-047). Validation uses a shared schema in `lib/validation/`.
- [ ] AC4: On create the price is required: a whole number of LKR above 0, stored as cents. `saveDocument` never changes the price of an existing document.
- [ ] AC5: Slug is made from the title on first save (same rules as articles: `lib/content/slug.ts`; reserved words refused; a clash adds a number). When the slug of a PUBLISHED document changes, a `slug_redirects` row is written and older redirects of that document are flattened to the newest slug.
- [ ] AC6: An edit carries the `updated_at` the admin loaded; a changed row returns `version_conflict`.
- [ ] AC7: `changeDocumentPrice(id, newPriceLkr, confirmedLargeChange, authenticatorCode)` needs `documents.*` (action `documents.price`), a fresh authenticator code (step-up helper, S-038; a correct code is valid 5 minutes for further money actions) and writes `price.change` with the old and new values. Without a fresh code: `mfa_required`.
- [ ] AC8: A change of more than 50 percent up or down is refused with `validation_failed` reason `confirm_large_change` unless `confirmedLargeChange` is true.
- [ ] AC9: Pending orders keep their price snapshot; only new orders use the new price (nothing to do in this story beyond not touching orders; test proves orders are untouched).
- [ ] AC10: Every write writes exactly one audit row: `document.save` for create and edit, `price.change` for a price change.
- [ ] AC11: Writes are rate limited per staff person: 60 writes a minute in general (`rate_limited`).
- [ ] AC12: A document list or detail never contains a file key.

## Edge cases

- [ ] EC1: Price 0, negative, decimal, huge, or text is refused.
- [ ] EC2: Title only spaces, over 200 characters, or containing script text: refused or stored as plain text and escaped on display.
- [ ] EC3: Category not in the fixed list, or type not in the three: `validation_failed`.
- [ ] EC4: Title `admin` or `api` as a slug source gets a safe slug (reserved words).
- [ ] EC5: Two admins edit the same document: the second gets `version_conflict`.
- [ ] EC6: Role removed while the admin works: next call refused; a Maintainer with no permissions is refused.
- [ ] EC7: Price change of exactly 50 percent is allowed without the extra confirmation; 51 percent needs it.
- [ ] EC8: Step-up code used 6 minutes ago: `mfa_required`.
- [ ] EC9: Price drop of more than 50 percent three times in one day by one person: see Assumptions (limit is PROPOSED).

## Contract

Types added or changed in `types/document.ts` (backend defines): `AdminDocumentRow`, `AdminDocument`, `DocumentFileMark`, `SaveDocumentInput`. Audit events used: `document.save`, `price.change`. Permission names: `documents.*`.

## Out of scope

- Language file and preview uploads and publish or hide (S-070).
- Owner alert emails (S-100) and the daily owner digest (S-100).
- Deleting a document: not in the audit event list and not offered once any order exists; hide instead (admin panel 6.4, ASSUMPTION).
- Coupons (Release 2).
- The admin screens (S-072, S-073).

## Assumptions accepted

- All permission rows are PROPOSED (admin panel 4.3, M16, Q62, Q63): Admin has `documents.*`; Maintainer has none. Owner to accept.
- Step-up code before any price change (S13, PROPOSED) and the 5-minute validity (ASSUMPTION).
- The more-than-50-percent confirmation (commerce 17, "to confirm") and a limit of 2 price drops of more than 50 percent per person per day with an owner alert (M8, PROPOSED). The limit is enforced here; the alert email is S-100.
- Q69: Checklists, Safety Signs and Toolbox Talks are the only types at launch (REQ-042b ASSUMED).
- The category list is fixed and seeded (S-020); its final content is Q69.
- Spec gap: the document row has no version column in the schema; the optimistic check uses `updated_at`.

## Test plan

| Test | Type | File |
|---|---|---|
| AC1, AC2 permission: Super Admin, Admin pass; Maintainer, customer, anonymous refused | integration (local Supabase) | `lib/admin/actions/__tests__/documents.perm.db.test.ts` |
| AC3, EC1 to EC3 validation | unit | `lib/admin/actions/__tests__/documents.validate.test.ts` |
| AC4 price only on create | unit | `lib/admin/actions/__tests__/documents.save.test.ts` |
| AC5, EC4 slug rules and redirect after publish | integration | `lib/admin/actions/__tests__/documents.slug.db.test.ts` |
| AC6, EC5 stale save refused | integration | `lib/admin/actions/__tests__/documents.save.db.test.ts` |
| AC7, EC8 step-up required | unit | `lib/admin/actions/__tests__/price.test.ts` |
| AC8, EC7 50 percent boundary | unit | `lib/admin/actions/__tests__/price.test.ts` |
| AC9 existing orders unchanged | integration | `lib/admin/actions/__tests__/price.db.test.ts` |
| AC10 one audit row per write | integration | `lib/admin/actions/__tests__/documents.audit.db.test.ts` |
| AC12 no file key in any response | unit | `lib/admin/actions/__tests__/documents.shape.test.ts` |
| EC9 daily drop limit | unit | `lib/admin/actions/__tests__/price.test.ts` |

## Plan

<!-- Filled in by /story-run at Step 3. Do not edit manually. -->
Prior art: read in full `admin-panel-design` sections 4.3 (rows 9, 10), 6.1 to 6.6, 9 (S13), 16; `commerce-design` sections 10, 12; `database-schema` Group E (`documents`, `document_files`); `file-structure` (`app/admin/documents/`). Extends S-015 (tables) and uses S-038 (step-up and audit helpers); the slug helper comes from S-048. Supersedes nothing.

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges, a user can:

- (Backend only.) A staff member with `documents.*` can create and edit a document record and change its price with a fresh authenticator code. No screen uses it yet.

## After this merges, these still do NOT work:

- No files, no publishing (S-070). A document created here is a draft nobody can see or buy.
- No admin screens (S-072, S-073).
- Follow-up: S-070, S-072.
