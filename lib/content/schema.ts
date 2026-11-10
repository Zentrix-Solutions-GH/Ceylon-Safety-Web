// Article body schema — shared by saveArticle (server) and the editor (S-054).
// Validates structure, limits, marks and block types.

export const SCHEMA_VERSION = 1;

export const MAX_BODY_BYTES = 1_048_576; // 1 MB text length (octet_length)
export const MAX_TOP_BLOCKS = 80;
export const MAX_LIST_DEPTH = 3;
export const MAX_LINKS = 100;
export const MAX_LINK_LENGTH = 2048;

// PROVISIONAL font list — Q10 is OPEN. Update when the project owner confirms.
export const ALLOWED_FONTS = ["Georgia", "Arial", "Roboto", "Open Sans", "Lato"] as const;
export type AllowedFont = (typeof ALLOWED_FONTS)[number];

const ALLOWED_BLOCK_TYPES = new Set([
  "paragraph",
  "heading",
  "blockquote",
  "bulletList",
  "orderedList",
  "listItem",
  "hardBreak",
  "image",
  "video",
  "document_spot",
  "course_spot",
  "ad_slot",
]);

// Inline node types that are valid children of block nodes
const ALLOWED_INLINE_TYPES = new Set(["text", "hardBreak"]);

const ALLOWED_MARK_TYPES = new Set([
  "bold",
  "italic",
  "underline",
  "link",
  "namedStyle",
  "namedFont",
]);

const ALLOWED_NAMED_STYLES = new Set(["title", "sub-topic", "paragraph", "other"]);

type ValidationResult = { ok: true } | { ok: false; reason: string };

function countLinks(nodes: unknown[]): number {
  let count = 0;
  for (const node of nodes) {
    const n = node as Record<string, unknown>;
    if (Array.isArray(n.marks)) {
      for (const m of n.marks as Record<string, unknown>[]) {
        if (m.type === "link") count++;
      }
    }
    if (Array.isArray(n.content)) count += countLinks(n.content as unknown[]);
  }
  return count;
}

function checkLinkLengths(nodes: unknown[]): string | null {
  for (const node of nodes) {
    const n = node as Record<string, unknown>;
    if (Array.isArray(n.marks)) {
      for (const m of n.marks as Record<string, unknown>[]) {
        if (m.type === "link") {
          const attrs = m.attrs as Record<string, unknown> | undefined;
          const href = typeof attrs?.href === "string" ? attrs.href : "";
          if (href.length > MAX_LINK_LENGTH) return href;
        }
      }
    }
    if (Array.isArray(n.content)) {
      const found = checkLinkLengths(n.content as unknown[]);
      if (found) return found;
    }
  }
  return null;
}

/** Returns an error string if the href is not a valid article link, null if ok. */
export function validateLinkHref(href: string): string | null {
  // Allow only https:// and http:// schemes (D6, content design §6.1)
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return `link "${href}" is not a valid URL`;
  }
  const scheme = url.protocol; // includes trailing colon
  if (scheme !== "https:" && scheme !== "http:") {
    return `link scheme "${scheme}" is not allowed; use https or http`;
  }
  // Refuse username/password in URL (https://good.com@evil.com)
  if (url.username || url.password) {
    return `link contains credentials and is not allowed`;
  }
  // Refuse control characters
  if (/[\x00-\x1f\x7f]/u.test(href)) {
    return `link contains control characters and is not allowed`;
  }
  return null;
}

function validateNode(
  node: Record<string, unknown>,
  listDepth: number
): ValidationResult {
  const type = node.type as string;

  if (!ALLOWED_BLOCK_TYPES.has(type) && !ALLOWED_INLINE_TYPES.has(type)) {
    return { ok: false, reason: `unknown block type: "${type}"` };
  }

  // Validate marks on text nodes
  if (type === "text" && Array.isArray(node.marks)) {
    for (const mark of node.marks as Record<string, unknown>[]) {
      const mt = mark.type as string;
      if (!ALLOWED_MARK_TYPES.has(mt)) {
        return { ok: false, reason: `unknown mark type: "${mt}"` };
      }
      if (mt === "namedFont") {
        const attrs = mark.attrs as Record<string, unknown> | undefined;
        if (!ALLOWED_FONTS.includes(attrs?.font as AllowedFont)) {
          return { ok: false, reason: `font "${attrs?.font}" is not in the allowed font list` };
        }
      }
      if (mt === "namedStyle") {
        const attrs = mark.attrs as Record<string, unknown> | undefined;
        if (!ALLOWED_NAMED_STYLES.has(attrs?.style as string)) {
          return { ok: false, reason: `named style "${attrs?.style}" is not allowed` };
        }
      }
      if (mt === "link") {
        const attrs = mark.attrs as Record<string, unknown> | undefined;
        const href = typeof attrs?.href === "string" ? attrs.href : "";
        const schemeError = validateLinkHref(href);
        if (schemeError) return { ok: false, reason: schemeError };
      }
    }
  }

  // List depth check
  if (type === "bulletList" || type === "orderedList") {
    if (listDepth >= MAX_LIST_DEPTH) {
      return { ok: false, reason: `list nesting exceeds ${MAX_LIST_DEPTH} levels` };
    }
  }

  // Recurse into content
  if (Array.isArray(node.content)) {
    const nextDepth =
      type === "bulletList" || type === "orderedList" ? listDepth + 1 : listDepth;
    for (const child of node.content as Record<string, unknown>[]) {
      const childResult = validateNode(child, nextDepth);
      if (!childResult.ok) return childResult;
    }
  }

  return { ok: true };
}

export function validateBody(body: unknown): ValidationResult {
  const b = body as Record<string, unknown>;

  if (typeof b?.schema_version !== "number") {
    return { ok: false, reason: "schema_version is required" };
  }
  if (b.schema_version !== SCHEMA_VERSION) {
    return { ok: false, reason: `unsupported schema_version: ${b.schema_version}` };
  }

  if (b.type !== "doc") {
    return { ok: false, reason: "body must have type 'doc'" };
  }

  // Size check on UTF-8 byte length (matches PostgreSQL octet_length)
  const jsonText = JSON.stringify(body);
  const byteLength = new TextEncoder().encode(jsonText).length;
  if (byteLength > MAX_BODY_BYTES) {
    return { ok: false, reason: `body size (${byteLength} bytes) exceeds ${MAX_BODY_BYTES} byte limit` };
  }

  const content = Array.isArray(b.content) ? (b.content as Record<string, unknown>[]) : [];

  // Top-level block count
  if (content.length > MAX_TOP_BLOCKS) {
    return { ok: false, reason: `body has ${content.length} top-level blocks; limit is ${MAX_TOP_BLOCKS}` };
  }

  // Link count
  const linkCount = countLinks(content);
  if (linkCount > MAX_LINKS) {
    return { ok: false, reason: `body has ${linkCount} links; limit is ${MAX_LINKS}` };
  }

  // Link length
  const longLink = checkLinkLengths(content);
  if (longLink) {
    return { ok: false, reason: `link address exceeds ${MAX_LINK_LENGTH} characters` };
  }

  // Validate each top-level block
  for (const node of content) {
    const result = validateNode(node, 0);
    if (!result.ok) return result;
  }

  return { ok: true };
}

// ─── Ref extraction helpers ───────────────────────────────────────────────────

export type RefKind = "document" | "course" | "video" | "media";

export interface BodyRef {
  node_id: string;
  ref_type: RefKind;
  ref_id: string;
}

/** Walk the body and collect all external references (document, course, video, media). */
export function extractRefs(nodes: unknown[]): BodyRef[] {
  const refs: BodyRef[] = [];
  for (const node of nodes) {
    const n = node as Record<string, unknown>;
    const type = n.type as string;
    const attrs = (n.attrs ?? {}) as Record<string, unknown>;

    if (type === "video" && attrs.node_id && attrs.video_id) {
      refs.push({ node_id: attrs.node_id as string, ref_type: "video", ref_id: attrs.video_id as string });
    } else if (type === "document_spot" && attrs.node_id && attrs.document_id) {
      refs.push({ node_id: attrs.node_id as string, ref_type: "document", ref_id: attrs.document_id as string });
    } else if (type === "course_spot" && attrs.node_id && attrs.course_id) {
      refs.push({ node_id: attrs.node_id as string, ref_type: "course", ref_id: attrs.course_id as string });
    } else if (type === "image" && attrs.node_id && attrs.key) {
      // key is a media path; store the key as ref_id for the orphan scan
      refs.push({ node_id: attrs.node_id as string, ref_type: "media", ref_id: attrs.key as string });
    }

    if (Array.isArray(n.content)) {
      refs.push(...extractRefs(n.content as unknown[]));
    }
  }
  return refs;
}
