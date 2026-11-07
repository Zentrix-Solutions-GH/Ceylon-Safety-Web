// S-054: RichTextEditor component — AC1 render, AC2 named styles, AC3 paste, AC6 font

import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

// Tiptap requires DOM APIs not fully available in jsdom — mock the module.
vi.mock("@tiptap/react", () => ({
  useEditor: vi.fn(() => null),
  EditorContent: ({ editor }: { editor: unknown }) =>
    editor ? <div data-testid="editor-content" /> : <div data-testid="editor-loading" />,
}));

vi.mock("@tiptap/starter-kit", () => ({ default: { configure: vi.fn(() => ({})) } }));
vi.mock("@tiptap/extension-underline", () => ({ default: {} }));
vi.mock("@tiptap/extension-link", () => ({ default: { configure: vi.fn(() => ({})) } }));
vi.mock("@tiptap/core", () => ({ Mark: { create: vi.fn(() => ({})) } }));

import { RichTextEditor, countUnknownPastedNodes } from "@/components/admin/ArticleEditor/RichTextEditor";

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
    // Options: Body, Heading 2, Heading 3, Quote
    expect(screen.getByRole("option", { name: /heading 2/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /heading 3/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /body/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /quote/i })).toBeInTheDocument();
  });

  it("renders font selector dropdown (AC6)", () => {
    render(<RichTextEditor onChange={vi.fn()} />);
    const fontSelect = screen.getByRole("combobox", { name: /font/i });
    expect(fontSelect).toBeInTheDocument();
    // Should have at least one font option besides default
    expect(screen.getByRole("option", { name: /default font/i })).toBeInTheDocument();
  });

  it("style option labels use t() — no raw hardcoded English in option text", () => {
    render(<RichTextEditor onChange={vi.fn()} />);
    // The style dropdown must NOT have raw literals like "h2" as option text
    const options = screen.getAllByRole("option");
    // Values are the internal keys (paragraph, h2, h3, blockquote) — but labels must not equal the values
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

  it("counts <script> as unknown", () => {
    const html = "<p>text</p><script>alert(1)</script>";
    expect(countUnknownPastedNodes(html)).toBeGreaterThan(0);
  });

  it("does not count known elements", () => {
    const html = "<h2>Title</h2><ul><li>item</li></ul><blockquote><p>quote</p></blockquote>";
    expect(countUnknownPastedNodes(html)).toBe(0);
  });
});
