---
id: S-108
title: Contact Coach page
status: blocked
owner: frontend
risk: normal
branch: feature/S-108-contact-coach
pr: ~
depends_on: [S-018, S-020, S-027]
reqs: [REQ-071, REQ-072, REQ-073, REQ-074, REQ-075, REQ-079, REQ-080, REQ-081, REQ-082, REQ-083, REQ-084]
---

## Blocked

- **Q29 / M31 (P3, P10)**: which number the WhatsApp button opens, whether trainers have their own number, and on which pages the floating button shows. The design default is "company number; Home, Contact Coach and Courses only", but these are PENDING owner decisions.
- **Q74**: the training services list is "ends with etc." and has no descriptions yet. The page text (`contact-coach-services`) is client content.
- **M32 (P6, P7)**: signed trainer consent and participant-photo consent. Trainer data is public personal data.
- **M34 / Q61 (P8)**: written client sign-off that phone, email and WhatsApp replace the promised "Training Enquiry Portal". Design says to get it before development starts.
- Unblock: the owner records answers (or accepts the design defaults in writing) and the status moves to `ready`.

## Goal

A visitor opens `/contact-coach`, sees what the trainers do, and contacts a trainer by phone, email or WhatsApp. There is no enquiry form. The same story builds the floating WhatsApp button that shows on Home, Contact Coach and Courses.

## Requirements covered

- REQ-071: A Contact Coach page shows trainer information. CONFIRMED
- REQ-072: Show trainer biography and professional information. CONFIRMED
- REQ-073: Show qualifications and certifications. CONFIRMED
- REQ-074: Show training topics and programs. CONFIRMED (shown as the `contact-coach-services` page text; `training_programs` stays off, trainer design decision 6)
- REQ-075: Show experience and achievements. CONFIRMED
- REQ-079: Training activity slideshow, images managed by admin. CONFIRMED (Release 1: images seeded by migration, S-020)
- REQ-080: WhatsApp button for direct contact. CONFIRMED (open detail: Q29)
- REQ-081: Training services offered. CONFIRMED (open detail: Q74)
- REQ-082: Trainer card: photo, name, position, phone, email. CONFIRMED
- REQ-083: "Introduction and experience" section. CONFIRMED
- REQ-084: No form-based enquiry system; only trainer contact details are shown. CONFIRMED
- REQ-076 to REQ-078 are NOT IN V1 and are not built.

## Acceptance criteria

- [ ] AC1: `/contact-coach` renders, in this order: heading "Contact Coach" with "Talk to our safety trainers"; activity slideshow; "Introduction and experience" rich text (page `contact-coach-intro`); one card per active trainer; training services rich text (page `contact-coach-services`); closing line "To book training, call, email or WhatsApp a trainer." A block with no data is not rendered.
- [ ] AC2: Slideshow shows up to 10 active images in admin order, in a fixed 16:9 box (middle crop by CSS only), with Previous and Next buttons, swipe on a phone, a visible "Slide n of m" label, no auto-play. The first image loads at once, the others lazily. One image: no controls. No image: no block. Every image has `alt` text and an optional caption; hidden slides are not read out by a screen reader.
- [ ] AC3: Trainer card shows photo (square crop by CSS; if none, a grey circle with initials taken by grapheme so Sinhala and Tamil names do not break; alt "Photo of {name}"), name, position, optional bio (max 600 characters), optional qualifications and experience. Cards are ordered by admin order number, then name, and have the anchor `#trainer-<slug>` (never a numeric id).
- [ ] AC4: Contact links: phone as `tel:` link plus the number in text (international form as stored); email as `mailto:` link plus the address in text (no obfuscation); WhatsApp button only when the trainer has a number, link `https://wa.me/<digits>` (digits only, no plus) opening in a new tab with `rel="noopener noreferrer"`. Accessible names are "Call {name}", "Email {name}", "WhatsApp {name}".
- [ ] AC5: Empty state: when there is no published trainer the page shows "To book training, call, email or WhatsApp us." with the company phone, email and WhatsApp number from the settings, and the page carries a `noindex` robots meta tag.
- [ ] AC6: Floating WhatsApp button (component mounted once in the public layout, allow-list of paths `/`, `/contact-coach`, `/courses`): bottom right, round, at least 48 px, accessible label "Chat on WhatsApp", number from setting `whatsapp_number`; not rendered when the setting is empty or on any other path; sits below the cookie bar (it moves up while the bar shows) and below the article popup layer; never covers the top banner or the side ad columns (checked at 1280 px and 375 px).
- [ ] AC7: The page has no form, no ads and no ad script; it never reads the session on the server; it is cached at most 60 seconds (public page, cleared on demand by the backend).
- [ ] AC8: All fixed text comes from `messages/en.ts` through `t()`; layout has no sideways scroll at 360 px and at 200% zoom; every tap target is at least 44 by 44 px on a phone; axe finds zero serious or critical issues on the page.
- [ ] AC9: Evidence in the story file: screenshots at 375 px and 1280 px for 0, 1 and 12 trainers.

## Edge cases

- [ ] EC1: 0, 1 and 12 trainers; 0, 1 and 10 slides: no layout error.
- [ ] EC2: Trainer name only in Sinhala or Tamil and no photo: initials render correctly (grapheme split).
- [ ] EC3: Trainer with phone only, email only, or WhatsApp only: only the existing links show; the card never renders an empty link.
- [ ] EC4: `whatsapp_number` empty in settings: no floating button, and the trainer cards still work.
- [ ] EC5: Cookie bar visible on a phone: the floating button moves above it.
- [ ] EC6: JavaScript off: text and links work; slideshow shows the first image; no banner, ads or analytics.
- [ ] EC7: Settings unreachable: the page uses the last cached chrome, else the safe footer, and still renders.
- [ ] EC8: Rich text contains `javascript:` or `data:` links: they are not rendered as links (link policy of content design 6.1, enforced by the shared renderer).

## Contract

- Consumes (defined by the backend): result of `getContactCoachPage` (images, intro, active trainers, services, company contacts for the empty state) and public settings via `getSiteChrome`. Types: `types/trainer.ts`, `types/page.ts`, `types/setting.ts`.
- Defines no types.

## Out of scope

- Any enquiry form, enquiry table or enquiry email (REQ-076 to REQ-078, REQ-139; a form later is a change request, REQ-210).
- Admin screens for trainers and activity images (Release 2). Content is seeded by S-020.
- WhatsApp "tap" analytics event: it must only be sent after Accept and needs the consent store (S-028) and the analytics loader. See Spec gaps.
- Live chat (REQ-208), slideshow auto-play, map and opening hours, trainers in Home search.
- The Courses page itself (S-109); this story only adds `/courses` to the button allow-list.

## Assumptions accepted

- A1: block order and the heading and closing-line wording (trainer design 3.1).
- A2: slideshow with 10 images, 16:9, no auto-play, arrows and swipe, lazy loading.
- A3: up to 12 trainers on one page, no paging.
- A4: optional per-trainer WhatsApp number (pending P10 / M31).
- A5: floating button only on Home, Contact Coach and Courses (pending P3 / M31).
- A6: `wa.me` link format and the optional fixed `?text=` greeting without personal data.
- A23: empty state shows company contacts and the page is `noindex`.
- A24: trainer anchors use the slug.
- A28: button at bottom right, round, at least 48 px, label "Chat on WhatsApp".
- These are ASSUMPTION items in the design. The owner must accept them (or change them) before this story becomes `ready`.

## Spec gaps

- No roster story defines the public read calls `getContactCoachPage` and `getSiteChrome` (trainer design 13). They live in `lib/` (backend). A backend story is needed before this one; the parent should add it.
- Rich-text rendering for the intro and services (JSON, link policy 6.1) uses the shared renderer `lib/content/render.tsx`, which is first built in the article page story (S-060). This story's `depends_on` does not list it.
- The roster `depends_on` does not list S-024 (image component, two widths), S-022 (fonts with Sinhala and Tamil glyphs) or S-028 (consent store). They arrive through S-027, but the glyph check of the fonts is a fact still to verify (trainer design 19, item 7).
- S-018 must contain schema changes 1, 2 and 9 of trainer design 7.2 (`activity_images.alt_text`, `trainers.whatsapp_number`, `trainers.slug`). Not verified here.
- The WhatsApp tap event (A25) is left out; whoever loads analytics must add it behind `getConsent`.

## Test plan

| Test | Type | File |
|---|---|---|
| AC1 block order and hidden empty blocks | component | `__tests__/contact-coach/page.test.tsx` |
| AC2 slideshow controls, label, one image, no image | component | `__tests__/contact-coach/slideshow.test.tsx` |
| AC3 card parts, order, anchor, grapheme initials (Sinhala, Tamil) | unit + component | `__tests__/contact-coach/trainer-card.test.tsx` |
| AC4 `tel:`, `mailto:`, `wa.me` link building and accessible names | unit | `__tests__/contact-coach/links.test.ts` |
| AC5 empty state and `noindex` | component | `__tests__/contact-coach/empty-state.test.tsx` |
| AC6 button allow-list, empty setting, cookie-bar offset | component | `__tests__/shared/whatsapp-button.test.tsx` |
| AC7 no form field, no script tag, no session read | component | `__tests__/contact-coach/page.test.tsx` |
| AC8 messages map covers all text; axe | component | `__tests__/contact-coach/a11y.test.tsx` |

## Plan

Prior art: written at story creation on 2026-10-25 from trainer-and-public-pages design sections 3.1, 5, 13, 22, 23, 24 and milestones MS6; `grep -ril "contact coach" docs/` matches 12 spec files and PROJECT_STATUS.md. This story implements the Release 1 part of those designs and does not supersede anything. `/story-run` must repeat the grep and update this line.

<!-- Rest filled in by /story-run at Step 3. Do not edit manually. -->

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges, a user can:

- Open `/contact-coach` and see the activity slideshow, the introduction, the trainer cards and the services text (with the trainers and text seeded by S-020).
- Call, email or WhatsApp a trainer from the card.
- Use the floating WhatsApp button on Home, Contact Coach and Courses.

## After this merges, these still do NOT work:

- Booking training through a form (not built in v1).
- Staff editing trainers, images or the introduction (Release 2).
- WhatsApp tap counting in analytics.
- The Courses and Jobs pages (S-109).
- Real trainer and services content until the client supplies it and signs the consent (M32, Q74).
