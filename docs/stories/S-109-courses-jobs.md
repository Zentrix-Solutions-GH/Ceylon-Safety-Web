---
id: S-109
title: Courses grid, course pages, Jobs placeholder
status: blocked
owner: frontend
risk: normal
branch: feature/S-109-courses-jobs
pr: ~
depends_on: [S-018, S-027]
reqs: [REQ-018, REQ-018b, REQ-061b, REQ-062b, REQ-064b, REQ-065b, REQ-066b]
---

## Blocked

- **Q25 (marked BLOCKS)**: what "not in V1" meant for admin course cards. REQ-066b is ASSUMED, not confirmed. Release 1 shows seeded cards, but whether course cards exist in v1 at all follows this answer.
- **Q26**: whether the price still shows on a "coming soon" card (REQ-062b open detail) and how: "LKR 12,500", "Free" or "Price on request".
- Not blocking, but needed before launch: Q27 (how many cards at launch).
- Unblock: the client (or the owner, for the design default) answers Q25 and Q26 in writing; the status moves to `ready`.

## Goal

Visitors can browse information cards for courses that are "coming soon", open a course information page, and see a clearly marked Jobs placeholder. Nothing can be bought or applied for.

## Requirements covered

- REQ-018: Navigation menu on every page: Home, Articles, Documents, Courses, Jobs, Contact Coach, Sign In / Sign Up, Cart. CONFIRMED (the menu itself is S-025; this story provides the Courses and Jobs destinations)
- REQ-018b: Jobs page in v1: a "Coming soon" label and a sample layout only. CONFIRMED
- REQ-061b: A Courses page exists in v1 as an information catalogue. CONFIRMED
- REQ-062b: Course card: thumbnail, title, level, number of lessons, duration, price or Free label. CONFIRMED (price display open, Q26)
- REQ-064b: Courses are not purchasable in v1. Cards show information with a "Coming soon" flag. CONFIRMED
- REQ-065b: Full online courses are not in v1. CONFIRMED
- REQ-066b: Admin creates and edits course cards. ASSUMED. In Release 1 the cards are seeded by migration (S-020); the admin screens are Release 2.

## Acceptance criteria

- [ ] AC1: `/courses` shows a grid of published, non-deleted course cards (three across on a wide screen, one on a phone), newest first, with no filters. Each card shows thumbnail (or a plain placeholder; alt text is the course title), title, level (Beginner, Intermediate or Advanced) only if set, "12 lessons" only if set and never "0 lessons", duration "3 hours 30 min" only if set, the price as decided in Q26, and a visible text label "Coming soon". The whole card links to `/courses/[slug]`. There is no buy path.
- [ ] AC2: `/courses/[slug]` shows the same fields plus the category and the description (plain text with paragraphs), the sentence "This course is not open yet. It will be available in a later version of the website.", a link "Ask a coach about training" to `/contact-coach` and a link "Back to courses". There is no buy button, no "notify me" and no promo video.
- [ ] AC3: A hidden, draft or deleted course returns a real 404. Before returning 404 the page checks the redirect lookup and returns a permanent redirect when the old slug exists.
- [ ] AC4: With no published course `/courses` shows "Courses are coming soon." and a link to Articles.
- [ ] AC5: `/jobs` shows a large "Coming soon", the text "A place for safety jobs and job seekers is planned. This page shows how it may look.", and three generic sample cards, each labelled "Sample", with no real names. The cards are not clickable; there is no Apply, search or form. The page has a `noindex` robots meta tag. The content is fixed text in code (no database).
- [ ] AC6: None of the three routes shows ads or loads an ad script; the pages never read the session on the server; they are cached at most 60 seconds (public pages, cleared on demand by the backend).
- [ ] AC7: `/courses` is on the floating WhatsApp button allow-list defined in S-108 (the button shows there).
- [ ] AC8: All fixed text comes from `messages/en.ts`; axe finds zero serious or critical issues; no sideways scroll at 360 px.

## Edge cases

- [ ] EC1: A course with no thumbnail, no level, no lessons, no duration: card shows only title, price and the label.
- [ ] EC2: Price per Q26: a number shows "LKR 12,500", Free shows "Free", Price on request shows "Price on request".
- [ ] EC3: Course slug changed after publish: the old address redirects permanently to the newest one (one hop).
- [ ] EC4: Course hidden while a visitor has its page open: the next load returns 404.
- [ ] EC5: Description with a very long unbroken word: no horizontal overflow.

## Contract

- Consumes (defined by the backend): `listCourses`, `getCourse` (with redirect lookup; `not_found`). Types: `types/course.ts`.
- Defines no types.

## Out of scope

- Buying courses, lessons, certificates (REQ-064b, REQ-065b, REQ-220), "notify me" signup (REQ-207, not in v1).
- Course cards inside articles (REQ-035, REQ-063b): the `course_spot` editor block is Release 3 (R8), and the client must agree.
- Admin screens for courses (Release 2, pending Q25 / M33), the promo video, filters, a course order column.
- A real Jobs page (REQ-231).
- Sitemap and metadata details (S-111).

## Assumptions accepted

- A9: cards have no filters, are ordered newest first, the flag is always on, and the promo video is not shown.
- A10: a course slug change after publish writes a redirect (the redirect rows are the backend's).
- A11: Jobs is fixed text in code and `noindex`.
- A20: WCAG 2.1 AA target, 360 px smallest width (see S-119 for the final standard).
- A30: wording "This course is not open yet. It will be available in a later version of the website."
- REQ-066b (ASSUMED): Release 1 reads seeded cards only.

## Spec gaps

- No roster story defines `listCourses` and `getCourse` (including the redirect lookup). A backend story is needed.
- The trainer design says "newest first" but the schema has no order column (change 5 is "later"). Newest first uses `created_at`; the parent should confirm.
- Trainer design 3.2 says the card shows "level, lessons, duration" as optional columns; confirm S-018 has them.

## Test plan

| Test | Type | File |
|---|---|---|
| AC1 card fields, omitted optional fields, price variants | component | `__tests__/courses/course-card.test.tsx` |
| AC2 course page content, no buy button, no promo video | component | `__tests__/courses/course-page.test.tsx` |
| AC3 404 and permanent redirect | unit | `__tests__/courses/not-found.test.ts` |
| AC4 empty state | component | `__tests__/courses/courses-page.test.tsx` |
| AC5 Jobs text, three "Sample" cards, not clickable, `noindex` | component | `__tests__/jobs/jobs-page.test.tsx` |
| AC6 no script tag, no session read | component | `__tests__/courses/courses-page.test.tsx` |
| AC8 messages map and axe | component | `__tests__/courses/a11y.test.tsx` |

## Plan

Prior art: written at story creation on 2026-10-25 from trainer-and-public-pages design sections 3.2, 3.3, 7 and 22 and requirements sections 3 and 6; `grep -ril "courses" docs/` matches 14 spec files and `grep -ril "jobs page" docs/` matches 5. This story implements the Release 1 part and does not supersede anything. `/story-run` must repeat the grep and update this line.

<!-- Rest filled in by /story-run at Step 3. Do not edit manually. -->

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges, a user can:

- Browse the Courses grid and open a course information page that says it is not open yet.
- Open the Jobs page and see the "Coming soon" placeholder.

## After this merges, these still do NOT work:

- Buying or enrolling in a course, "notify me", lessons.
- Course cards inside articles (Release 3).
- Staff creating or editing courses (Release 2).
- Real course content until Q25, Q26 and Q27 are answered and the cards are seeded.
