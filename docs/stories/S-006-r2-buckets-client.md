---
id: S-006
title: R2 buckets, CORS, R2 client
status: ready
owner: backend
risk: sensitive
branch: feature/S-006-r2-buckets-client
pr: ~
depends_on: [S-003]
reqs: [REQ-055, REQ-154]
---

## Goal

Create the Cloudflare R2 buckets for staging and production and the server code that uploads, signs and deletes objects, so later stories can store images, document files, invoices and bank slips without ever exposing a permanent file link or a file key.

## Requirements covered

- REQ-055 (CONFIRMED): downloads are protected; no permanent public file links; the server checks the buyer's right to each file. The private bucket and short-lived signed links are the base for this.
- REQ-154 (CONFIRMED): bank slips are uploaded and need private storage (requirements B2 and B4).
- Infrastructure design 4 (bucket names per environment), 7.2 (R2 buckets, lifecycle, keys) and 10 (R2 app keys per environment); file structure design `lib/r2/storage.ts` and `lib/media/`.

## Acceptance criteria

- [ ] AC1: buckets exist with these names: staging `cs-staging-public`, `cs-staging-private`; production `cs-prod-public`, `cs-prod-private`, `cs-prod-backups`. The private buckets and the backups bucket have no public access. The `r2.dev` public address is switched off on every bucket.
- [ ] AC2: R2 API tokens are separate per environment and limited to that environment's buckets. The application keys are set only as server environment values; `lib/config.ts` gains the R2 account id, access key id, secret, and the bucket names, all required at startup. No key is in the repository or logs.
- [ ] AC3: `lib/r2/storage.ts` provides: put object, create a short-lived signed GET link (default 60 seconds), create a presigned PUT link for a browser upload, and delete object. It talks to R2 through the S3-compatible API and never returns or logs the secret.
- [ ] AC4: object keys are validated before use: no `..`, no leading `/`, no control characters, maximum length 512; invalid keys throw without calling R2.
- [ ] AC5: `lib/media/` provides the public URL builder: `PUBLIC_MEDIA_BASE_URL` + key, and presign helpers for image uploads. The base URL is a required setting; missing it fails at startup.
- [ ] AC6: CORS on the private bucket allows the site origin (staging or production) to PUT with the headers needed for a presigned browser upload, so large document files go straight to R2 and never through our server (schema design upload flow). The public bucket allows GET from the site origin.
- [ ] AC7: lifecycle rule on every private bucket: incomplete multipart uploads are aborted after 1 day (infrastructure design 7.2).
- [ ] AC8: local development uses the `dev/` prefix inside the staging buckets; the prefix is applied by the storage module, not by callers.
- [ ] AC9: a real round trip is proven on `cs-staging-private`: upload an object with a presigned PUT, read it with a 60-second signed GET, confirm the link stops working after it expires, delete the object. Output is pasted in Evidence.

## Edge cases

- [ ] EC1: a caller passes a key with `../`. Rejected before any request.
- [ ] EC2: a signed link is requested for an object that does not exist. R2 answers 404; the module reports "not found" and callers must check existence before handing out a link (commerce design `release_download` rule).
- [ ] EC3: the signed link lifetime is zero or negative or more than 15 minutes. Rejected with a clear error (the specs say 60 seconds for downloads; the cap is a safety limit set here).
- [ ] EC4: a presigned PUT is used with a different content type than expected. The server that created it records the expected type; the later confirm step (upload stories) checks the real size and type.
- [ ] EC5: an upload is abandoned halfway. The lifecycle rule aborts the multipart upload after 1 day; deletion of abandoned objects is a later job (not in this story).
- [ ] EC6: a secret appears in an error message from the SDK. Errors from the storage module are wrapped; the message contains the bucket name and operation only.

## Contract

Types added or changed in `types/` by this story:
- (none). `types/media.ts` is created by the first upload story (S-047).

## Out of scope

- Upload and download endpoints and the confirm step (S-047, S-070, S-083, S-085).
- The `img.ceylonsafety.com` custom domain on the public bucket (S-009).
- Backups bucket keys, lifecycle and slips copy (S-116).
- Cleaning abandoned uploads (a Release 1 job in the jobs list with no story yet).
- Image resizing (browser side, S-055).

## Assumptions accepted

- Bucket names and the staging `dev/` prefix are ASSUMPTIONS in the design (infrastructure design 18, item 5) and are accepted here.
- The R2 account is in the client's name (I8, M30; Q49 pending).
- Presigned PUT cannot enforce a maximum size on its own (to verify); the maximum is enforced by the server at the confirm step.

## Test plan

| Test | Type | File |
|---|---|---|
| AC4 key validation (traversal, leading slash, control characters, length) | unit | `__tests__/r2-storage.test.ts` |
| AC3 signed link default 60 seconds, bounds on lifetime | unit | `__tests__/r2-storage.test.ts` |
| AC8 `dev/` prefix applied in local mode only | unit | `__tests__/r2-storage.test.ts` |
| AC5 public URL builder, missing base fails | unit | `__tests__/media.test.ts` |
| AC3 errors contain no secrets | unit | `__tests__/r2-storage.test.ts` |
| AC9 real upload, signed read, expiry, delete on staging | manual, evidence | story Evidence |
| AC1 private bucket cannot be read without a signed link (anonymous request returns 403 or 404) | manual, evidence | story Evidence |

## Plan

Prior art: read infrastructure design 4, 7.2, 10 and 20 (buckets, keys, lifecycle, write-only keys to verify), file structure design (`lib/r2/`, `lib/media/`, `PUBLIC_MEDIA_BASE_URL`), commerce design download rules and schema design 14.5 (browser uploads straight to R2). No R2 code exists. Replaces the earlier draft story of the same name.

<!-- Filled in by /story-run at Step 3. Do not edit manually. -->

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges, a user can:

Nothing visible to site users. This PR is infrastructure: later stories can store and sign files; the buckets exist and the private ones cannot be read without a signed link.

## After this merges, these still do NOT work:

Any upload or download feature, images on the site, the `img.` address, backups, and cleaning of abandoned uploads.

## After this merges

- S-047 (image upload), S-070 (document files), S-083 (bank slips), S-116 (backups bucket keys) and S-009 (image domain).

## Spec gaps

- Exact CORS rules are not written in the specs; the minimum above is derived from the browser-uploads-straight-to-R2 rule.
- Whether R2 keys can be write-only or prefix-limited (to verify, infrastructure design 7.2) matters for S-116, not here.
- No maximum signed-link lifetime is given beyond 60 seconds for downloads.

## Re-baseline note

None; fits one day.
