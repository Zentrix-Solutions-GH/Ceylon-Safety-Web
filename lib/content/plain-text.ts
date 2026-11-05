// Rebuild body_text from the article body JSON.
// Walks the structured JSON and returns a plain-text string for search indexing.

export function bodyToPlainText(body: unknown): string {
  const b = body as Record<string, unknown>;
  if (!b || !Array.isArray(b.content)) return "";
  return extractText(b.content as unknown[]).trim();
}

function extractText(nodes: unknown[]): string {
  const parts: string[] = [];
  for (const node of nodes) {
    const n = node as Record<string, unknown>;
    const type = n.type as string;

    if (type === "text" && typeof n.text === "string") {
      parts.push(n.text);
    } else if (type === "hardBreak") {
      parts.push("\n");
    } else if (type === "image") {
      const attrs = (n.attrs ?? {}) as Record<string, unknown>;
      if (typeof attrs.alt === "string" && attrs.alt) parts.push(attrs.alt);
      if (typeof attrs.caption === "string" && attrs.caption) parts.push(attrs.caption);
    }

    if (Array.isArray(n.content)) {
      const childText = extractText(n.content as unknown[]);
      if (childText) parts.push(childText);
    }

    // Add a space between block-level nodes
    if (["paragraph", "heading", "listItem", "bulletList", "orderedList"].includes(type)) {
      parts.push(" ");
    }
  }
  return parts.join("").replace(/\s+/g, " ");
}
