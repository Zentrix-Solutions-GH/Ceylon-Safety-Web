---
id: S-054
title: Editor core — text styles, fonts, lists, marks
status: ready
owner: frontend
risk: normal
branch: feature/S-054-editor-core-text-styles
pr: ~
depends_on: [S-045]
reqs: [REQ-034, REQ-034b]
---

## Goal

Build the Tiptap-based rich-text editor foundation used by the article editor. This covers the editable canvas, fixed named styles (Heading 2, Heading 3, Body, Quote), self-hosted fonts from design tokens, marks (bold, italic, underline, link), bullet and numbered lists (max 3 deep), clipboard cleaning, and the shared content schema from `lib/content/schema.ts`. All subsequent editor blocks (image, video, document card) mount on top of this core.

## Requirements covered

- REQ-034: Admin can write article text with fixed styles, bold, italic, underline, links, and lists
- REQ-034b: No SVG or GIF images; no free CSS styles — only named values from the allow-list
- REQ-034d (partial): foundation only; document card block in S-077

## Acceptance criteria

- [ ] AC1: `RichTextEditor` renders inside `ArticleEditor` on `/admin/articles/new` with the formatting toolbar (styles dropdown, bold, italic, underline, link, bullet list, numbered list)
- [ ] AC2: Selecting text and choosing a named style (H2, H3, Body, Quote) applies it; the resulting JSON node `type` matches the style name, never raw HTML
- [ ] AC3: Pasting rich content from the clipboard strips unknown marks and nodes; the editor shows a toast "Cleaned N item(s) from pasted content" when N > 0
- [ ] AC4: Lists nest at most 3 levels; pressing Tab beyond level 3 does nothing
- [ ] AC5: `lib/content/schema.ts` `validateBody(json)` returns `{ valid: true }` for output from the editor and `{ valid: false, errors: [...] }` for a body that exceeds 1 MB, 80 blocks, or 3 list levels
- [ ] AC6: Self-hosted fonts defined in design tokens are selectable and stored as named values (e.g. `{ type: "mark", attrs: { font: "OpenSans" } }`), never as inline CSS
- [ ] AC7: A link mark accepts `https` and `http` URLs only; entering `javascript:` or a bare path is refused with an inline error
- [ ] AC8: The editor is loaded only in the admin bundle (dynamic import with `ssr: false`); it does not appear in the `/_next/static/chunks/` bundle for public routes

## Edge cases

- [ ] EC1: Pasting from Microsoft Word with complex markup — unknown nodes stripped, plain text preserved
- [ ] EC2: Body exceeds 80 top-level blocks — editor shows a warning and disables further block insertion
- [ ] EC3: Link URL over 2048 characters — inline validation error shown, link not applied
- [ ] EC4: Admin navigates away with unsaved changes — browser leave-page warning shown (handled in S-057 shell; this story ensures the editor reports `isDirty`)
- [ ] EC5: Q10 is OPEN (font list not confirmed by client) — fonts rendered using the placeholder list from design tokens; blocked story S-022 handles the real list; this story uses whatever S-022 defines

## Contract

Types added or changed in `types/` by this story (for contract-checker agent):
- (none — schema lives in `lib/content/schema.ts`, not in `types/`)

## Out of scope

- Image, video, document card, course card, ad slot blocks (S-055, S-056, S-077, Release 2/3)
- Save flow, local backup, version conflict (S-057)
- Admin articles list (S-058)
- Server-side body validation on save (S-048 already owns the route; this story provides the shared schema it calls)

## Assumptions accepted

- D1: one editor document per article; structured JSON never HTML
- D8: JPEG, PNG, WebP only for images (relevant to the image block later)
- Named styles: Heading 2, Heading 3, Body (paragraph), Quote — the exact list from content design section 5.3
- Tiptap core is the chosen editor; `@tiptap/react` + `@tiptap/starter-kit` loaded via dynamic import

## Test plan

| Test | Type | File |
|---|---|---|
| validateBody accepts valid JSON | unit | `__tests__/lib/content/schema.test.ts` |
| validateBody rejects > 1 MB body | unit | `__tests__/lib/content/schema.test.ts` |
| validateBody rejects > 80 top-level blocks | unit | `__tests__/lib/content/schema.test.ts` |
| validateBody rejects > 3 list nesting levels | unit | `__tests__/lib/content/schema.test.ts` |
| link mark rejects non-http(s) scheme | unit | `__tests__/lib/content/schema.test.ts` |
| RichTextEditor renders without crashing | component | `__tests__/components/admin/ArticleEditor/RichTextEditor.test.tsx` |
| Named style stored as node type, not CSS | component | `__tests__/components/admin/ArticleEditor/RichTextEditor.test.tsx` |
| Paste cleaning removes unknown nodes | component | `__tests__/components/admin/ArticleEditor/RichTextEditor.test.tsx` |

## Plan

Prior art: `grep -ril "tiptap\|rich.text\|editor" docs/` → content system design section 5, file-structure section 3 (`components/admin/ArticleEditor/`). No existing code. This story creates the foundation.

<!-- Filled in by /story-run at Step 3. Do not edit manually. -->

## Evidence

<!-- Paste scripts/check.sh output here after Step 7 -->

```
$ bash scripts/check.sh
```

## Review notes

<!-- Filled in by reviewer/security-reviewer agents and /full-review -->

## After this merges

- S-055 (image block) and S-056 (video block) can begin
