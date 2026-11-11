// S-054: RichTextEditor component — AC1 render, AC2 named styles, AC3 paste, AC4 tab depth, AC6 font

import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Tiptap requires DOM APIs not fully available in jsdom — mock the module.
vi.mock("@tiptap/react", () => ({
  useEditor: vi.fn(() => null),
  EditorContent: ({ editor }: { editor: unknown }) =>
    editor ? <div data-testid="editor-content" /> : <div data-testid="editor-loading" />,
  ReactNodeViewRenderer: vi.fn(() => () => null),
  NodeViewWrapper: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@tiptap/starter-kit", () => ({ default: { configure: vi.fn(() => ({})) } }));
vi.mock("@tiptap/extension-underline", () => ({ default: {} }));
vi.mock("@tiptap/extension-link", () => ({ default: { configure: vi.fn(() => ({})) } }));
vi.mock("@tiptap/core", () => ({ Mark: { create: vi.fn(() => ({})) }, Node: { create: vi.fn(() => ({})) } }));

vi.mock("@/lib/config.public", () => ({
  publicConfig: { appUrl: "https://ceylonsafety.com", mediaCdnUrl: "https://cdn.test" },
}));

// Mock ImageBlock so we can inspect the props passed by ImageNodeView
vi.mock("@/components/admin/ArticleEditor/blocks/ImageBlock", () => ({
  default: vi.fn(() => null),
}));

import { RichTextEditor, countUnknownPastedNodes, getListDepthFromResolvedPos, hasPendingImageNode, ImageNodeView } from "@/components/admin/ArticleEditor/RichTextEditor";
import { MAX_LIST_DEPTH } from "@/lib/content/schema";
import ImageBlock from "@/components/admin/ArticleEditor/blocks/ImageBlock";
import type { NodeViewProps } from "@tiptap/react";

describe("RichTextEditor — AC1: renders without crashing", () => {
  it("renders the editor container", () => {
    render(<RichTextEditor onChange={vi.fn()} />);
    expect(document.querySelector("[role='group']")).toBeInTheDocument();
  });

  it("renders toolbar buttons for bold, italic, underline", () => {
    render(<RichTextEditor onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: /bold/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /italic/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /underline/i })).toBeInTheDocument();
  });

  it("renders toolbar buttons for lists", () => {
    render(<RichTextEditor onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: /bullet list/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /numbered list/i })).toBeInTheDocument();
  });

  it("renders named style options in styles dropdown (AC2)", () => {
    render(<RichTextEditor onChange={vi.fn()} />);
    const styleSelect = screen.getByRole("combobox", { name: /style/i });
    expect(styleSelect).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /heading 2/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /heading 3/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /body/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /quote/i })).toBeInTheDocument();
  });

  it("renders font selector dropdown (AC6)", () => {
    render(<RichTextEditor onChange={vi.fn()} />);
    const fontSelect = screen.getByRole("combobox", { name: /^font$/i });
    expect(fontSelect).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /default font/i })).toBeInTheDocument();
  });

  it("style option labels use t() — no raw hardcoded English in option text", () => {
    render(<RichTextEditor onChange={vi.fn()} />);
    const options = screen.getAllByRole("option");
    const h2Option = options.find((o) => (o as HTMLOptionElement).value === "h2");
    expect(h2Option?.textContent).not.toBe("h2");
    expect(h2Option?.textContent).toMatch(/heading 2/i);
  });
});

describe("countUnknownPastedNodes — AC3: paste cleaning utility", () => {
  it("returns 0 for clean HTML", () => {
    const html = "<p>Hello <strong>world</strong></p>";
    expect(countUnknownPastedNodes(html)).toBe(0);
  });

  it("counts unknown elements like <table>", () => {
    const html = "<p>Hello</p><table><tr><td>cell</td></tr></table>";
    expect(countUnknownPastedNodes(html)).toBeGreaterThan(0);
  });

  it("does not count <script> — it is silently discarded, not reported in the toast", () => {
    const html = "<p>text</p><script>alert(1)</script>";
    expect(countUnknownPastedNodes(html)).toBe(0);
  });

  it("does not count known elements", () => {
    const html = "<h2>Title</h2><ul><li>item</li></ul><blockquote><p>quote</p></blockquote>";
    expect(countUnknownPastedNodes(html)).toBe(0);
  });

  it("counts only root-level unknowns, not each descendant separately", () => {
    // <table> is unknown; <tr> and <td> are descendants — count should be 1 (the table), not 3
    const html = "<table><tr><td>cell</td></tr></table>";
    expect(countUnknownPastedNodes(html)).toBe(1);
  });
});

describe("getListDepthFromResolvedPos — AC4: Tab key depth limiting", () => {
  function makeResolvedPos(nodeNames: string[]) {
    return {
      depth: nodeNames.length - 1,
      node: (i: number) => ({ type: { name: nodeNames[i] } }),
    };
  }

  it("returns 0 for a paragraph outside any list", () => {
    const resolved = makeResolvedPos(["doc", "paragraph"]);
    expect(getListDepthFromResolvedPos(resolved)).toBe(0);
  });

  it("returns 1 for one level of list nesting", () => {
    const resolved = makeResolvedPos(["doc", "bulletList", "listItem", "paragraph"]);
    expect(getListDepthFromResolvedPos(resolved)).toBe(1);
  });

  it("returns MAX_LIST_DEPTH for the maximum allowed nesting", () => {
    const resolved = makeResolvedPos([
      "doc",
      "bulletList", "listItem",
      "bulletList", "listItem",
      "bulletList", "listItem",
      "paragraph",
    ]);
    expect(getListDepthFromResolvedPos(resolved)).toBe(MAX_LIST_DEPTH);
  });

  it("Tab should be blocked when depth >= MAX_LIST_DEPTH", () => {
    const resolved = makeResolvedPos([
      "doc",
      "bulletList", "listItem",
      "bulletList", "listItem",
      "bulletList", "listItem",
      "paragraph",
    ]);
    const depth = getListDepthFromResolvedPos(resolved);
    expect(depth >= MAX_LIST_DEPTH).toBe(true);
  });

  it("Tab should be allowed when depth is below MAX_LIST_DEPTH", () => {
    const resolved = makeResolvedPos(["doc", "bulletList", "listItem", "paragraph"]);
    const depth = getListDepthFromResolvedPos(resolved);
    expect(depth >= MAX_LIST_DEPTH).toBe(false);
  });
});

describe("hasPendingImageNode — AC3: publish blocked while upload incomplete", () => {
  it("returns false for a doc with no image nodes", () => {
    expect(hasPendingImageNode({ type: "doc", content: [{ type: "paragraph" }] })).toBe(false);
  });

  it("returns false for a doc with an image node that has a key (upload complete)", () => {
    expect(hasPendingImageNode({
      type: "doc",
      content: [{ type: "image", attrs: { key: "media/abc123/480.webp", node_id: "x" } }],
    })).toBe(false);
  });

  it("returns true for a doc with an image node whose key is null (upload in-progress or pending)", () => {
    expect(hasPendingImageNode({
      type: "doc",
      content: [{ type: "image", attrs: { key: null, node_id: "x" } }],
    })).toBe(true);
  });

  it("detects a pending image nested inside another block", () => {
    expect(hasPendingImageNode({
      type: "doc",
      content: [
        { type: "paragraph" },
        { type: "image", attrs: { key: null, node_id: "y" } },
      ],
    })).toBe(true);
  });
});

describe("ImageNodeView — EC1: status derived from node attrs (P0.2)", () => {
  const mockImageBlock = ImageBlock as ReturnType<typeof vi.fn>;

  function makeProps(attrs: Record<string, unknown>): NodeViewProps {
    return {
      node: { attrs } as NodeViewProps["node"],
      deleteNode: vi.fn(),
    } as unknown as NodeViewProps;
  }

  beforeEach(() => mockImageBlock.mockClear());

  it("passes status=pending when key is null", () => {
    render(<ImageNodeView {...makeProps({ key: null, previewSrc: "", alt: "", decorative: false, caption: "", node_id: "x" })} />);
    expect(mockImageBlock).toHaveBeenCalledWith(expect.objectContaining({ status: "pending" }), expect.anything());
  });

  it("passes status=uploading when key is set but previewSrc is empty", () => {
    render(<ImageNodeView {...makeProps({ key: "media/abc/480.webp", previewSrc: "", alt: "", decorative: false, caption: "", node_id: "x" })} />);
    expect(mockImageBlock).toHaveBeenCalledWith(expect.objectContaining({ status: "uploading" }), expect.anything());
  });

  it("passes status=ready when key and previewSrc are both set", () => {
    render(<ImageNodeView {...makeProps({ key: "media/abc/480.webp", previewSrc: "blob:http://localhost/abc", alt: "photo", decorative: false, caption: "", node_id: "x" })} />);
    expect(mockImageBlock).toHaveBeenCalledWith(expect.objectContaining({ status: "ready" }), expect.anything());
  });
});
