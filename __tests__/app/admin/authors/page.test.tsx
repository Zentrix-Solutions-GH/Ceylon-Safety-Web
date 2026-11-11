// S-058: admin authors screen — AC6, AC7

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

vi.mock("@/lib/config.ts", () => ({
  config: {
    supabaseUrl: "https://test.supabase.co",
    supabaseAnonKey: "anon",
    supabaseServiceRoleKey: "service",
    appUrl: "https://ceylonsafety.com",
    mediaCdnUrl: "https://cdn.test",
  },
}));

const mockSaveAuthor = vi.fn();
vi.mock("@/lib/authors/actions/saveAuthor", () => ({
  saveAuthor: (...args: unknown[]) => mockSaveAuthor(...args),
}));

const mockSetAuthorActive = vi.fn();
vi.mock("@/lib/authors/actions/setAuthorActive", () => ({
  setAuthorActive: (...args: unknown[]) => mockSetAuthorActive(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  redirect: vi.fn((url: string): never => { throw new Error(`NEXT_REDIRECT:${url}`); }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) =>
    React.createElement("a", { href }, children),
}));

import AuthorsPageClient from "@/app/admin/authors/AuthorsPageClient";
import AuthorForm from "@/components/admin/AuthorForm";
import type { Author } from "@/types/author";

const AUTHORS: Author[] = [
  { id: "author-1", name: "Alice", slug: "alice", bio: null, isActive: true, updatedAt: "2026-10-01T00:00:00Z" },
  { id: "author-2", name: "Bob", slug: "bob", bio: "Bio text", isActive: false, updatedAt: "2026-10-02T00:00:00Z" },
];

beforeEach(() => {
  mockSaveAuthor.mockReset();
  mockSetAuthorActive.mockReset();
});

describe("AuthorsPageClient — AC6 (list)", () => {
  it("renders author names, inactive badge, and add button", () => {
    render(<AuthorsPageClient initialAuthors={AUTHORS} />);
    expect(screen.getByText("Alice")).toBeTruthy();
    expect(screen.getByText("Bob")).toBeTruthy();
    expect(screen.getByTestId("author-inactive-badge-author-2")).toBeTruthy();
    expect(screen.getByRole("link", { name: /add author/i })).toHaveAttribute(
      "href",
      "/admin/authors/new"
    );
  });
});

describe("AuthorForm — AC6 (form validation)", () => {
  it("shows name error on empty submit", async () => {
    const user = userEvent.setup();
    render(<AuthorForm />);
    await user.click(screen.getByRole("button", { name: /save author/i }));
    expect(screen.getByTestId("author-name-error")).toBeTruthy();
    expect(mockSaveAuthor).not.toHaveBeenCalled();
  });

  it("calls saveAuthor with name and bio on valid submit", async () => {
    const user = userEvent.setup();
    mockSaveAuthor.mockResolvedValue({ ok: true, author: AUTHORS[0] });
    render(<AuthorForm />);
    await user.type(screen.getByTestId("author-name-input"), "New Author");
    await user.type(screen.getByTestId("author-bio-input"), "Some bio");
    await user.click(screen.getByRole("button", { name: /save author/i }));
    expect(mockSaveAuthor).toHaveBeenCalledWith(
      expect.objectContaining({ name: "New Author", bio: "Some bio" })
    );
  });
});

describe("AuthorsPageClient — AC7 (toggle active)", () => {
  it("inactive row has opacity-50 class", () => {
    render(<AuthorsPageClient initialAuthors={AUTHORS} />);
    const inactiveRow = screen.getByTestId("author-row-author-2");
    expect(inactiveRow.className).toContain("opacity-50");
  });

  it("toggle button calls setAuthorActive with active: false for active author", async () => {
    const user = userEvent.setup();
    mockSetAuthorActive.mockResolvedValue({ ok: true, author: { ...AUTHORS[0], isActive: false } });
    render(<AuthorsPageClient initialAuthors={AUTHORS} />);
    await user.click(screen.getByTestId("author-toggle-active-author-1"));
    expect(mockSetAuthorActive).toHaveBeenCalledWith(
      expect.objectContaining({ id: "author-1", active: false })
    );
  });
});
