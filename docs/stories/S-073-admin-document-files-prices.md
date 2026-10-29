---
id: S-073
title: Admin document files, previews, prices
status: ready
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

- [ ] AC1: `components/admin/DocumentLanguageFiles.tsx` shows three upload boxes (English, Sinhala, Tamil) and one preview box. Each box shows its status: Missing, Uploading, Ready or Failed, and the version.
- [ ] AC2: Choosing a file calls `startDocumentFileUpload` (S-070), sends the file straight to the returned upload link with a progress bar, then calls `completeDocumentFileUpload`. Large PowerPoint files never go through our own routes.
- [ ] AC3: The box refuses a file of the wrong kind before upload (full files `.pptx`, preview `.png`, `.jpg`, `.pdf`) and shows the server reason for `file_type` and `file_too_large`; `upload_failed` shows "The upload did not finish. Try again." with a retry button.
- [ ] AC4: A re-upload shows a new version only after the new file is Ready; the old one stays shown until then.
- [ ] AC5: Publish and Hide buttons call `setDocumentStatus`. When the server answers `files_missing`, the screen shows "Upload all three language files and the preview first." and lists which of the three languages and the preview are missing.
- [ ] AC6: Before Hide, the screen calls `countArticleRefs`; if the count is above 0 it shows "Used in N articles. Those articles will show it as unavailable." and asks for confirmation.
- [ ] AC7: Price change dialog: shows old and new price side by side. A change of more than 50 percent shows a second, stronger confirmation naming the percentage. The dialog asks for the authenticator code and sends it with `changeDocumentPrice`. `confirm_large_change` shows "Please confirm this large price change." and `mfa_required` shows "Enter the code from your authenticator app."
- [ ] AC8: After a publish or hide the screen shows the purge warning when the server returns it: "The change is saved but the site may show the old page for a few minutes."
- [ ] AC9: All server messages are mapped from the code to the plain sentences in admin panel 17; no raw error codes reach the page.

## Edge cases

- [ ] EC1: Browser closed mid-upload: on return the box shows Uploading or Failed from the server state, with a retry.
- [ ] EC2: Two languages uploading at once keep separate progress.
- [ ] EC3: Publish pressed twice: the second answer `already_done` shows "This was already done." and the page updates.
- [ ] EC4: Price change of exactly 50 percent shows no second confirmation; 51 percent does.
- [ ] EC5: Wrong or expired authenticator code: the dialog stays open with the message; nothing changes.
- [ ] EC6: A very large file on a slow network shows progress and can be cancelled; cancelling leaves the previous Ready file in place.
- [ ] EC7: Role lost while on the screen: next action shows "You do not have permission to do this."

## Contract

Types consumed (read-only, S-069 and S-070): `DocumentFileMark`, `UploadStart`, `UploadStatus`, `DocumentLanguage` in `types/document.ts`. No type changes.

## Out of scope

- The owner alert on replacing a language file of a published document (S-100, backend).
- Document delete.
- Automatic preview generation.
- Any customer-facing display (S-074, S-076).

## Assumptions accepted

- The preview is one file per language, `png`, `jpg` or `pdf`, with the English one as fallback (schema, Q70 assumption). The upload box accepts those three types, so it works whichever way Q70 is answered as long as one file is enough.
- Authenticator step-up window of 5 minutes (ASSUMPTION, S13 PROPOSED) applies to the price dialog.

## Test plan

| Test | Type | File |
|---|---|---|
| AC1, AC4 file box states | component | `components/admin/__tests__/DocumentLanguageFiles.test.tsx` |
| AC2 upload sequence: start, direct upload, complete (mocked R2) | component | `components/admin/__tests__/DocumentLanguageFiles.test.tsx` |
| AC3 client-side type refusal and server reasons | component | `components/admin/__tests__/DocumentLanguageFiles.test.tsx` |
| AC5, EC3 publish refused message and listing | component | `components/admin/__tests__/PublishPanel.test.tsx` |
| AC6 "Used in N articles" confirmation | component | `components/admin/__tests__/PublishPanel.test.tsx` |
| AC7, EC4, EC5 price dialog flow | component | `components/admin/__tests__/PriceDialog.test.tsx` |
| AC9 message mapping has no raw codes | unit | `components/admin/__tests__/messages.test.ts` |
| Upload three files and a preview, publish, see it hidden/visible | e2e (local Supabase) | `e2e/admin-documents.spec.ts` |

## Plan

<!-- Filled in by /story-run at Step 3. Do not edit manually. -->
Prior art: read in full `admin-panel-design` sections 6.3, 6.4, 6.5, 14, 17, 18; `commerce-design` section 11 (undeliverable documents); `file-structure` (`components/admin/DocumentLanguageFiles.tsx`, `hooks/useMediaUpload.ts`); `frontend-architecture` section 8. Consumes S-070 and S-069; extends S-072; supersedes nothing.

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges, a user can:

- As an Admin, upload the three language files and a preview for a document, publish it when all are ready, hide it (with the articles warning), and change its price with the authenticator code and the large-change confirmation.

## After this merges, these still do NOT work:

- Visitors still see no Documents page until S-074.
- No owner alert when a language file of a published document is replaced (S-100).
- Follow-up: S-074.
