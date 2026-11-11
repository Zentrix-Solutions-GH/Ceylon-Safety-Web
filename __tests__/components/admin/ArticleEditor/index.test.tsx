// S-057: ArticleEditor save flow — AC1–AC8, EC1–EC2

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { saveArticle } from "@/lib/articles/actions/saveArticle";
import ArticleEditor from "@/components/admin/ArticleEditor/index";
import type { ArticleEditData } from "@/types/article";
import type { Author } from "@/types/author";
import type { Category } from "@/types/article";

vi.mock("@/lib/articles/actions/saveArticle", () => ({ saveArticle: vi.fn() }));

vi.mock("next/dynamic", () => ({
  default: (loader: () => Promise<{ default: React.ComponentType<unknown> }>) => {
    const Comp = React.lazy(loader);
    return function DynamicWrapper(props: Record<string, unknown>) {
      return (
        <React.Suspense fallback={null}>
          <Comp {...props} />
        </React.Suspense>
      );
    };
  },
}));

vi.mock("@/components/admin/ArticleEditor/RichTextEditor", () => ({
  RichTextEditor: function MockRTE({
    onChange,
    onEditorReady,
  }: {
    onChange?: (body: object) => void;
    onEditorReady?: (api: { insertImage: () => void }) => void;
  }) {
    React.useEffect(() => {
      onEditorReady?.({ insertImage: () => {} });
    }, [onEditorReady]);
    return (
      <button
        type="button"
        data-testid="rte-change"
        onClick={() => onChange?.({ type: "doc", content: [] })}
      >
        Change body
      </button>
    );
  },
}));

const BASE_ARTICLE: ArticleEditData = {
  id: "art-1",
  title: "Fire Safety",
  excerpt: "Stay safe from fire.",
  slug: "fire-safety",
  coverImageKey: "covers/fire.jpg",
  coverImageAlt: "Flames",
  coverImageStatus: "ready",
  authorId: "author-1",
  categoryId: "cat-1",
  publishedAt: null,
  status: "draft",
  body: { schema_version: 1, type: "doc", content: [] },
  bodyVersion: 3,
  seoTitle: null,
  seoDescription: null,
  resolvedVideos: [],
  resolvedDocuments: [],
};

const AUTHORS: Author[] = [
  { id: "author-1", name: "Alice", slug: "alice", bio: null, isActive: true, updatedAt: "2026-01-01T00:00:00Z" },
];

const CATEGORIES: Category[] = [
  { id: "cat-1", name: "Fire Safety", slug: "fire-safety" },
];

const mockSave = saveArticle as ReturnType<typeof vi.fn>;

function renderEditor(overrides: Partial<ArticleEditData> = {}) {
  return render(
    <ArticleEditor
      initialData={{ ...BASE_ARTICLE, ...overrides }}
      authors={AUTHORS}
      categories={CATEGORIES}
    />
  );
}

beforeEach(() => {
  mockSave.mockReset();
  localStorage.clear();
});

describe("AC1 — Save calls saveArticle and shows Saved toast", () => {
  it("calls saveArticle with current field values on save", async () => {
    mockSave.mockResolvedValueOnce({ ok: true, articleId: "art-1", bodyVersion: 4, slug: "fire-safety" });
    renderEditor();
    await userEvent.click(screen.getByRole("button", { name: /save draft/i }));
    expect(mockSave).toHaveBeenCalledOnce();
    expect(mockSave.mock.calls[0][0]).toMatchObject({
      articleId: "art-1",
      title: "Fire Safety",
      bodyVersion: 3,
    });
  });

  it("shows Saved toast after a successful save", async () => {
    mockSave.mockResolvedValueOnce({ ok: true, articleId: "art-1", bodyVersion: 4, slug: "fire-safety" });
    renderEditor();
    await userEvent.click(screen.getByRole("button", { name: /save draft/i }));
    expect(await screen.findByText("Saved")).toBeInTheDocument();
  });

  it("updates bodyVersion from server response", async () => {
    mockSave.mockResolvedValueOnce({ ok: true, articleId: "art-1", bodyVersion: 7, slug: "fire-safety" });
    renderEditor();
    await userEvent.click(screen.getByRole("button", { name: /save draft/i }));
    mockSave.mockResolvedValueOnce({ ok: true, articleId: "art-1", bodyVersion: 8, slug: "fire-safety" });
    await userEvent.click(screen.getByRole("button", { name: /save draft/i }));
    expect(mockSave.mock.calls[1][0]).toMatchObject({ bodyVersion: 7 });
  });
});

describe("AC1 / EC1 — version_conflict preserves backup", () => {
  it("shows conflict toast on 409 and keeps backup in localStorage", async () => {
    mockSave.mockResolvedValueOnce({ ok: false, code: "version_conflict" });
    renderEditor();
    await userEvent.click(screen.getByRole("button", { name: /save draft/i }));
    expect(await screen.findByText(/someone else changed/i)).toBeInTheDocument();
    expect(localStorage.getItem("cs-draft-art-1")).not.toBeNull();
  });
});

describe("AC2 — clears backup on successful save", () => {
  it("removes the localStorage backup after save succeeds", async () => {
    localStorage.setItem("cs-draft-art-1", JSON.stringify({ savedAt: Date.now(), bodyVersion: 3, title: "old" }));
    mockSave.mockResolvedValueOnce({ ok: true, articleId: "art-1", bodyVersion: 4, slug: "fire-safety" });
    renderEditor();
    await userEvent.click(screen.getByRole("button", { name: /save draft/i }));
    await screen.findByText("Saved");
    expect(localStorage.getItem("cs-draft-art-1")).toBeNull();
  });
});

describe("AC3 — restore banner shown when backup is newer (negative: stale backup ignored)", () => {
  it("does NOT show restore banner when backup bodyVersion is older than server version", () => {
    const backup = {
      savedAt: Date.now(),
      bodyVersion: 2, // older than BASE_ARTICLE.bodyVersion (3)
      title: "Old Draft",
      slug: "fire-safety",
      body: { type: "doc", content: [] },
      excerpt: "",
      coverImageKey: null,
      coverImageAlt: "",
      categoryId: "cat-1",
      authorId: "author-1",
      scheduledAt: null,
    };
    localStorage.setItem("cs-draft-art-1", JSON.stringify(backup));
    renderEditor();
    expect(screen.queryByText(/unsaved changes from/i)).toBeNull();
  });
});

describe("AC3 — restore banner shown when backup is newer", () => {
  it("shows restore banner when localStorage backup is newer than server version", () => {
    const backup = {
      savedAt: Date.now(),
      bodyVersion: 3,
      title: "Fire Safety Draft",
      slug: "fire-safety",
      body: { type: "doc", content: [] },
      excerpt: "Stay safe.",
      coverImageKey: null,
      coverImageAlt: "",
      categoryId: "cat-1",
      authorId: "author-1",
      scheduledAt: null,
    };
    localStorage.setItem("cs-draft-art-1", JSON.stringify(backup));
    renderEditor();
    expect(screen.getByText(/unsaved changes from/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /restore/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /discard/i })).toBeInTheDocument();
  });

  it("hides banner after Discard is clicked", async () => {
    const backup = { savedAt: Date.now(), bodyVersion: 3, title: "t", slug: "s", body: {}, excerpt: "", coverImageKey: null, coverImageAlt: "", categoryId: "c", authorId: "a", scheduledAt: null };
    localStorage.setItem("cs-draft-art-1", JSON.stringify(backup));
    renderEditor();
    await userEvent.click(screen.getByRole("button", { name: /discard/i }));
    expect(screen.queryByText(/unsaved changes from/i)).toBeNull();
  });
});

describe("AC5 — publish gating", () => {
  it("publish button is disabled when title is missing", () => {
    renderEditor({ title: "" });
    const btn = screen.getByRole("button", { name: /publish/i });
    expect(btn).toBeDisabled();
    expect(screen.getByText(/title/i, { selector: "li" })).toBeInTheDocument();
  });

  it("publish button is disabled when cover image is pending", () => {
    renderEditor({ coverImageStatus: "pending" });
    const btn = screen.getByRole("button", { name: /publish/i });
    expect(btn).toBeDisabled();
    expect(screen.getByText(/upload is not complete/i)).toBeInTheDocument();
  });

  it("publish button is disabled when scheduledAt is missing", () => {
    renderEditor({ publishedAt: null });
    const btn = screen.getByRole("button", { name: /publish/i });
    expect(btn).toBeDisabled();
  });

  it("publish button is enabled when all required fields are present", () => {
    renderEditor({ publishedAt: "2026-12-01T10:00:00+05:30" });
    const btn = screen.getByRole("button", { name: /publish/i });
    expect(btn).not.toBeDisabled();
  });
});

describe("AC7 — slug editable when draft, locked when published", () => {
  it("shows editable slug field for a draft article", () => {
    renderEditor({ status: "draft" });
    expect(screen.getByRole("textbox", { name: /slug/i })).toBeInTheDocument();
  });

  it("shows locked slug for a published article", () => {
    renderEditor({ status: "published" });
    expect(screen.queryByRole("textbox", { name: /slug/i })).toBeNull();
    expect(screen.getByText(/locked after/i)).toBeInTheDocument();
  });
});

describe("AC4 — beforeunload triggers when dirty", () => {
  it("sets returnValue on BeforeUnloadEvent when there are unsaved changes", async () => {
    renderEditor();
    await userEvent.click(screen.getByTestId("rte-change"));
    const event = new Event("beforeunload") as BeforeUnloadEvent;
    Object.defineProperty(event, "returnValue", { writable: true, value: undefined });
    window.dispatchEvent(event);
    expect(event.returnValue).toBe("");
  });
});

describe("EC2 (save path) — localStorage write failure does not break save", () => {
  it("still shows Saved toast even if writeBackup throws", async () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new DOMException("QuotaExceededError"); };
    mockSave.mockResolvedValueOnce({ ok: true, articleId: "art-1", bodyVersion: 4, slug: "fire-safety" });
    renderEditor();
    await userEvent.click(screen.getByRole("button", { name: /save draft/i }));
    expect(await screen.findByText("Saved")).toBeInTheDocument();
    Storage.prototype.setItem = original;
  });
});

describe("AC8 — save never sends status field", () => {
  it("saveArticle call does not include a status field", async () => {
    mockSave.mockResolvedValueOnce({ ok: true, articleId: "art-1", bodyVersion: 4, slug: "fire-safety" });
    renderEditor();
    await userEvent.click(screen.getByRole("button", { name: /save draft/i }));
    expect(mockSave.mock.calls[0][0]).not.toHaveProperty("status");
  });
});

describe("EC2 — localStorage throws silently", () => {
  it("still renders without crashing when localStorage is unavailable", () => {
    const original = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      get() { throw new Error("SecurityError: localStorage unavailable"); },
      configurable: true,
    });
    expect(() => renderEditor()).not.toThrow();
    if (original) Object.defineProperty(window, "localStorage", original);
  });
});
