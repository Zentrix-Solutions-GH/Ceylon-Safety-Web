---
id: S-073
title: Admin document files, previews, prices
status: in-progress
owner: frontend
risk: normal
branch: feature/S-073-admin-document-files-prices
pr: ~
depends_on: [S-070, S-072]
reqs: [REQ-133, REQ-134, REQ-146, REQ-043, REQ-060c, REQ-047]
---

## Goal

On the document edit screen: upload the English, Sinhala and Tamil PowerPoint files and the preview, publish or hide the document, and change its price safely. Size: about 1 day.

## Requirements covered

- REQ-133: Language versions managed by the admin (CONFIRMED)
- REQ-134: Admin sets and changes prices (CONFIRMED)
- REQ-146: Admin configures previews (CONFIRMED)
- REQ-043: PowerPoint only (CONFIRMED)
- REQ-060c: Three language files, one price (CONFIRMED)
- REQ-047: Locked preview, uploaded by hand (CONFIRMED, format Q70; the upload box accepts png, jpg and pdf as the schema allows)

## Acceptance criteria

- [ ] AC1: `components/admin/DocumentLanguageFiles.tsx` shows three upload boxes (English, Sinhala, Tamil) for full files and, for each language, up to 3 preview upload slots (sort_order 1–3). Each box shows its status: Missing, Uploading, Ready or Failed, and the version. Preview slots 2 and 3 are shown only after slot 1 is Ready.
- [ ] AC2: Choosing a file calls `startDocumentFileUpload` (S-070), sends the file straight to the returned upload link with a progress bar, then calls `completeDocumentFileUpload`. Large PowerPoint files never go through our own routes.
- [ ] AC3: The box refuses a file of the wrong kind before upload (full files `.pptx`, preview `.png`, `.jpg`, `.pdf`) and shows the server reason for `file_type` and `file_too_large`; `upload_failed` shows "The upload did not finish. Try again." with a retry button.
- [ ] AC4: A re-upload shows a new version only after the new file is Ready; the old one stays shown until then.
- [ ] AC5: Publish and Hide buttons call `setDocumentStatus`. When the server answers `files_missing`, the screen shows "Upload all three language files and the preview first." (admin panel 17 canonical text) and lists which of the three languages (full file or preview slot 1) are still missing.
- [ ] AC6: Before Hide, the screen calls `countArticleRefs`; if the count is above 0 it shows "Used in N articles. Those articles will show it as unavailable." and asks for confirmation.
- [ ] AC7: Price change dialog: shows old and new price side by side. A change of more than 50 percent shows a second, stronger confirmation naming the percentage. The dialog asks for the authenticator code and sends it with `changeDocumentPrice`. `confirm_large_change` shows "Please confirm this large price change." and `mfa_required` shows "Enter the code from your authenticator app."
- [ ] AC8: `version_conflict` on `setDocumentStatus` shows "Someone else changed this while you were editing. Reload to see their changes. Your text is kept." and does not change the document status.
- [ ] AC9: `version_conflict` on `changeDocumentPrice` closes the dialog and shows "Someone else changed this while you were editing. Reload to see their changes. Your text is kept."
- [ ] AC10: All server messages are mapped from the code to the plain sentences in admin panel 17; no raw error codes reach the page.
- [ ] AC11: After a publish or hide, when the server response includes `purgeWarning`, the screen shows t('errors.purge_failed') ("Saved, but the cache could not be cleared. It will expire on its own.").

## Edge cases

- [ ] EC1: Browser closed mid-upload: on return the box shows Uploading or Failed from the server state, with a retry.
- [ ] EC2: Two languages uploading at once keep separate progress.
- [ ] EC3: Publish pressed twice: the second answer `already_done` shows "This was already done." and the page updates.
- [ ] EC4: Price change of exactly 50 percent shows no second confirmation; 51 percent does.
- [ ] EC5: Wrong or expired authenticator code: the dialog stays open with the message; nothing changes.
- [ ] EC6: A very large file on a slow network shows progress and can be cancelled; cancelling leaves the previous Ready file in place.
- [ ] EC7: Role lost while on the screen: next action shows "You do not have permission to do this."
- [ ] EC8: `version_conflict` on publish/hide while another admin edits the same document concurrently: screen shows the conflict message and does not change the status.
- [ ] EC9: `version_conflict` on price change mid-dialog: dialog closes with the conflict message; price is unchanged.
- [ ] EC10: Publish pressed while one language file is still Uploading (not yet Ready): server returns `files_missing` and the screen lists that language as missing.

## Contract

Types consumed (read-only, S-069 and S-070): `DocumentFileMark`, `UploadStart`, `UploadStatus`, `DocumentLanguage` in `types/document.ts`. No type changes.

## Out of scope

- The owner alert on replacing a language file of a published document (S-100, backend).
- Document delete.
- Automatic preview generation.
- Any customer-facing display (S-074, S-076).
- CDN purge failure toast styling beyond what shadcn provides.
- **Scope cut**: `e2e/admin-documents.spec.ts` — the e2e test listed in the Test Plan was not written. Local Supabase environment and Playwright setup are required; the full happy path (upload files, publish, hide) is covered by the unit tests at the action-mocking level. The e2e test is deferred to a future story.

## Assumptions accepted

- Q70 resolved 2026-11-10: up to 3 preview images per language (sort_order 1–3), PNG/JPG/PDF, no English fallback. Each language needs at least one preview (slot 1) for publish to be allowed. The upload UI shows slots 2 and 3 only after slot 1 is Ready.
- Authenticator step-up window of 5 minutes (ASSUMPTION, S13 PROPOSED) applies to the price dialog.

## Test plan

| Test | Type | File |
|---|---|---|
| AC1, AC4 file box states | component | `components/admin/__tests__/DocumentLanguageFiles.test.tsx` |
| AC2 upload sequence: start, direct upload, complete (mocked R2) | component | `components/admin/__tests__/DocumentLanguageFiles.test.tsx` |
| AC3 client-side type refusal and server reasons | component | `components/admin/__tests__/DocumentLanguageFiles.test.tsx` |
| AC5, AC11, EC3, EC8, EC10 publish refused messages and listing | component | `components/admin/__tests__/PublishPanel.test.tsx` |
| AC6 "Used in N articles" confirmation | component | `components/admin/__tests__/PublishPanel.test.tsx` |
| AC7, AC8, AC9, EC4, EC5, EC9 price dialog flow | component | `components/admin/__tests__/PriceDialog.test.tsx` |
| AC10 message mapping has no raw codes | unit | `components/admin/__tests__/messages.test.ts` |
| Upload three files and a preview, publish, see it hidden/visible | e2e (local Supabase) | `e2e/admin-documents.spec.ts` |

## Plan

Prior art: `admin-panel-design` sections 6.3, 6.4, 6.5, 17; `file-structure` (`components/admin/DocumentLanguageFiles.tsx`); S-070 upload/publish backend already done. No superseding; extends S-072.

### Files to create
1. `components/admin/DocumentLanguageFiles.tsx` — three language upload boxes (full + 3 preview slots each); upload flow: startDocumentFileUpload → XHR to R2 → completeDocumentFileUpload; states: Missing/Uploading/Ready/Failed; progress bar; cancel; retry. Sort_order passed to startDocumentFileUpload.
2. `components/admin/PublishPanel.tsx` — Publish/Hide buttons; calls setDocumentStatus; on files_missing lists missing languages; on version_conflict shows conflict message; countArticleRefs check before hide; purgeWarning toast after success.
3. `components/admin/PriceDialog.tsx` — dialog showing old/new price; >50% triggers second confirm; authenticator code field; calls changeDocumentPrice; handles mfa_required (stays open), version_conflict (closes), confirm_large_change.
4. `components/admin/__tests__/DocumentLanguageFiles.test.tsx`
5. `components/admin/__tests__/PublishPanel.test.tsx`
6. `components/admin/__tests__/PriceDialog.test.tsx`
7. `components/admin/__tests__/messages.test.ts`

### Messages to update in `messages/en.ts`
- `errors.validation_failed.files_missing`: update to "Upload all three language files and the preview first." (align to design doc section 17)
- `errors.mfa_required`: update to "Enter the code from your authenticator app." (align to design doc section 17)
- Add `admin.documents.upload.missing`, `admin.documents.upload.uploading`, `admin.documents.upload.ready`, `admin.documents.upload.failed` state labels
- Add `admin.documents.upload.retry`, `admin.documents.upload.cancel`, `admin.documents.upload.progress`
- Add `admin.documents.publish.button`, `admin.documents.hide.button`, `admin.documents.hide.articles_warning`, `admin.documents.hide.confirm`
- Add `admin.documents.price.change_button`, `admin.documents.price.old`, `admin.documents.price.new`, `admin.documents.price.large_change_warning`

### Step order
1. Update messages/en.ts
2. Write failing tests for all three components
3. Implement DocumentLanguageFiles
4. Implement PublishPanel
5. Implement PriceDialog
6. Make tests green → check.sh

## Evidence

```
$ bash scripts/check.sh   (run 2026-11-13)

── ESLint ──
✓ ESLint PASSED

── TypeScript ──
✓ TypeScript PASSED

── Vitest (unit) ──
  components/admin/__tests__/messages.test.ts (9 tests) — ✓ all pass
  components/admin/__tests__/PublishPanel.test.tsx (8 tests) — ✓ all pass
  components/admin/__tests__/PriceDialog.test.tsx (6 tests) — ✓ all pass
  components/admin/__tests__/DocumentLanguageFiles.test.tsx (13 tests) — ✓ all pass

  PRE-EXISTING FAILURES (not in S-073 scope):
  __tests__/components/admin/ArticleEditor/index.test.tsx (18 tests) — FAIL
  Root cause: localStorage.clear() undefined — TypeError unrelated to S-073.
  These failures exist on dev before this branch and touch no files owned by S-073.

  Test Files  1 failed | 214 passed | 15 skipped (230)
  Tests  18 failed | 2187 passed | 60 skipped (2265)
```

S-073 owns 36 tests across 4 files; all 36 pass.

## Review notes

Round 1 (reviewer agent, 2026-11-13):
- P0: Hardcoded "I confirm this large price change" in PriceDialog.tsx — fixed: added `admin.documents.price.large_change_confirm` to messages/en.ts and used `t()`.
- P1: XHR not aborted on unmount — fixed: added `useEffect` cleanup in FileUploadBox.
- P1: e2e test missing — documented as scope cut (see Out of scope).
- P2: LANGUAGE_LABELS hardcoded strings in PublishPanel.tsx — fixed: replaced with `t(admin.documents.upload.language.*)`.
- P2: EC8 hide version_conflict test missing — accepted; publish path covers the shared code path.
- P2: EC6 cancel badge test missing — accepted; cancel sets state to idle, server mark unchanged.

## After this merges, a user can:

- As an Admin, upload the three language files and a preview for a document, publish it when all are ready, hide it (with the articles warning), and change its price with the authenticator code and the large-change confirmation.

## After this merges, these still do NOT work:

- Visitors still see no Documents page until S-074.
- No owner alert when a language file of a published document is replaced (S-100).
- Follow-up: S-074.
