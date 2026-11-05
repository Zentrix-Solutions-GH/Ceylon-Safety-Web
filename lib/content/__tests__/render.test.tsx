// S-049: lib/content/render — AC10, AC11, AC12, EC3

import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("@/lib/config.public", () => ({
  publicConfig: {
    supabaseUrl: "https://test.supabase.co",
    supabaseAnonKey: "anon",
    appUrl: "https://ceylonsafety.com",
    turnstileSiteKey: "test-key",
  },
}));

import { renderArticleBody } from "@/lib/content/render";
import type { ArticleBody, ArticleNode } from "@/types/article";

function makeBody(content: ArticleNode[]): ArticleBody {
  return { schema_version: 1, type: "doc", content };
}

// ─── AC10: renderer re-validates body and drops bad blocks ───────────────────

describe("renderArticleBody — AC10", () => {
  it("renders a valid paragraph", () => {
    const body = makeBody([
      { type: "paragraph", content: [{ type: "text", text: "Hello" }] },
    ]);
    const { container } = render(renderArticleBody(body));
    expect(container.textContent).toContain("Hello");
  });

  it("drops an unknown block type and renders the rest", () => {
    const body = makeBody([
      { type: "paragraph", content: [{ type: "text", text: "Good" }] },
      // @ts-expect-error intentional unknown block
      { type: "unknown_block", content: [] },
    ]);
    const { container } = render(renderArticleBody(body));
    expect(container.textContent).toContain("Good");
  });

  it("drops a video node with an invalid YouTube ID", () => {
    const body = makeBody([
      { type: "video", attrs: { node_id: "n1", video_id: "tooshort" } },
      { type: "paragraph", content: [{ type: "text", text: "After" }] },
    ]);
    const { container } = render(renderArticleBody(body));
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.textContent).toContain("After");
  });

  it("renders a video node with a valid YouTube ID", () => {
    const body = makeBody([
      { type: "video", attrs: { node_id: "n1", video_id: "dQw4w9WgXcQ" } },
    ]);
    const { container } = render(renderArticleBody(body));
    expect(container.querySelector("iframe")).not.toBeNull();
  });

  it("renders a document_spot node as 'not shown' (no error)", () => {
    const body = makeBody([
      { type: "document_spot", attrs: { node_id: "n1", document_id: "doc-123" } },
    ]);
    // Should not throw, renders nothing for doc spot
    const { container } = render(renderArticleBody(body));
    expect(container.querySelector("iframe")).toBeNull();
  });
});

// ─── EC3: >100 links treated as invalid; renderer drops excess ───────────────

describe("renderArticleBody — EC3 link limit", () => {
  it("renders up to 100 links without dropping", () => {
    const nodes: ArticleNode[] = Array.from({ length: 100 }, (_, i) => ({
      type: "paragraph",
      content: [
        {
          type: "text",
          text: `link ${i}`,
          marks: [{ type: "link", attrs: { href: `https://example.com/${i}` } }],
        },
      ],
    }));
    const { container } = render(renderArticleBody(makeBody(nodes)));
    const links = container.querySelectorAll("a");
    expect(links.length).toBe(100);
  });

  it("drops a paragraph containing the 101st link (excess block dropped)", () => {
    const nodes: ArticleNode[] = Array.from({ length: 101 }, (_, i) => ({
      type: "paragraph",
      content: [
        {
          type: "text",
          text: `link ${i}`,
          marks: [{ type: "link", attrs: { href: `https://example.com/${i}` } }],
        },
      ],
    }));
    // Add a plain paragraph after the excess
    nodes.push({ type: "paragraph", content: [{ type: "text", text: "tail" }] });
    const { container } = render(renderArticleBody(makeBody(nodes)));
    const links = container.querySelectorAll("a");
    expect(links.length).toBeLessThanOrEqual(100);
    // the tail paragraph should still render
    expect(container.textContent).toContain("tail");
  });
});

// ─── AC11: rel attributes, new tab on outbound, decorative alt ───────────────

describe("renderArticleBody — AC11 links", () => {
  it("adds rel=nofollow ugc noopener noreferrer to all links", () => {
    const body = makeBody([
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "click",
            marks: [{ type: "link", attrs: { href: "https://external.com" } }],
          },
        ],
      },
    ]);
    const { container } = render(renderArticleBody(body));
    const a = container.querySelector("a");
    expect(a?.getAttribute("rel")).toBe("nofollow ugc noopener noreferrer");
  });

  it("sets target=_blank for outbound links", () => {
    const body = makeBody([
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "external",
            marks: [{ type: "link", attrs: { href: "https://external.com/page" } }],
          },
        ],
      },
    ]);
    const { container } = render(renderArticleBody(body));
    const a = container.querySelector("a");
    expect(a?.getAttribute("target")).toBe("_blank");
  });

  it("renders an image with alt text", () => {
    const body = makeBody([
      {
        type: "image",
        attrs: { node_id: "n1", key: "imgs/photo.jpg", alt: "A photo", decorative: false },
      },
    ]);
    const { container } = render(renderArticleBody(body));
    const img = container.querySelector("img");
    expect(img?.getAttribute("alt")).toBe("A photo");
  });

  it("renders a decorative image with empty alt", () => {
    const body = makeBody([
      {
        type: "image",
        attrs: { node_id: "n1", key: "imgs/deco.jpg", decorative: true },
      },
    ]);
    const { container } = render(renderArticleBody(body));
    const img = container.querySelector("img");
    expect(img?.getAttribute("alt")).toBe("");
  });

  it("renders an image caption", () => {
    const body = makeBody([
      {
        type: "image",
        attrs: { node_id: "n1", key: "imgs/x.jpg", alt: "X", caption: "My caption" },
      },
    ]);
    const { container } = render(renderArticleBody(body));
    expect(container.textContent).toContain("My caption");
  });

  it("drops a link with javascript: scheme", () => {
    const body = makeBody([
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "xss",
            marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
          },
        ],
      },
    ]);
    const { container } = render(renderArticleBody(body));
    // text renders but no <a> element (link stripped)
    expect(container.textContent).toContain("xss");
    expect(container.querySelector("a")).toBeNull();
  });

  it("drops a link with data: scheme", () => {
    const body = makeBody([
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "data",
            marks: [{ type: "link", attrs: { href: "data:text/html,<h1>hi</h1>" } }],
          },
        ],
      },
    ]);
    const { container } = render(renderArticleBody(body));
    expect(container.querySelector("a")).toBeNull();
  });

  it("drops a link with credentials in URL", () => {
    const body = makeBody([
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "cred",
            marks: [{ type: "link", attrs: { href: "https://user:pass@evil.com" } }],
          },
        ],
      },
    ]);
    const { container } = render(renderArticleBody(body));
    expect(container.querySelector("a")).toBeNull();
  });

  it("drops a link with tab-obfuscated javascript: scheme (java\\tscript:)", () => {
    const body = makeBody([
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "xss-tab",
            marks: [{ type: "link", attrs: { href: "java\tscript:alert(1)" } }],
          },
        ],
      },
    ]);
    const { container } = render(renderArticleBody(body));
    expect(container.textContent).toContain("xss-tab");
    expect(container.querySelector("a")).toBeNull();
  });

  it("drops a protocol-relative link (//evil.com)", () => {
    const body = makeBody([
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "proto-rel",
            marks: [{ type: "link", attrs: { href: "//evil.com/steal" } }],
          },
        ],
      },
    ]);
    const { container } = render(renderArticleBody(body));
    expect(container.querySelector("a")).toBeNull();
  });

  it("does NOT set target=_blank for inbound links (same host)", () => {
    // publicConfig.appUrl is mocked to "https://ceylonsafety.com" in vi.mock above
    const body = makeBody([
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "inbound",
            marks: [{ type: "link", attrs: { href: "https://ceylonsafety.com/articles/fire-safety" } }],
          },
        ],
      },
    ]);
    const { container } = render(renderArticleBody(body));
    const a = container.querySelector("a");
    expect(a).not.toBeNull();
    expect(a?.getAttribute("target")).not.toBe("_blank");
  });
});

// ─── AC12: hostile text renders as plain text ────────────────────────────────

describe("renderArticleBody — AC12 XSS safety", () => {
  it("renders <script> in text node as plain text", () => {
    const body = makeBody([
      {
        type: "paragraph",
        content: [{ type: "text", text: "<script>alert(1)</script>" }],
      },
    ]);
    const { container } = render(renderArticleBody(body));
    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toContain("<script>alert(1)</script>");
  });

  it("renders <img onerror> in a heading as plain text", () => {
    const body = makeBody([
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: '<img src=x onerror="alert(1)">' }],
      },
    ]);
    const { container } = render(renderArticleBody(body));
    // The text is there but no injected img
    const imgs = container.querySelectorAll("img");
    expect(imgs.length).toBe(0);
  });

  it("renders hostile text in caption as plain text", () => {
    const body = makeBody([
      {
        type: "image",
        attrs: { node_id: "n1", key: "k.jpg", caption: "<script>evil()</script>" },
      },
    ]);
    const { container } = render(renderArticleBody(body));
    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toContain("<script>evil()</script>");
  });
});
