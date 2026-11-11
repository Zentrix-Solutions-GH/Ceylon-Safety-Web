import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CommentForm } from "@/components/articles/CommentForm";
import type { UserStatus } from "@/hooks/useArticleUserStatus";

const mockUserStatus = vi.fn<() => UserStatus>();
vi.mock("@/hooks/useArticleUserStatus", () => ({
  useArticleUserStatus: () => mockUserStatus(),
}));
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CommentForm", () => {
  it("AC4: signed-out user sees sign-in link", async () => {
    mockUserStatus.mockReturnValue("signed-out");
    render(<CommentForm articleId="a1" />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/sign-in");
  });

  it("EC1: suspended user sees suspended message", async () => {
    mockUserStatus.mockReturnValue("suspended");
    render(<CommentForm articleId="a1" />);
    expect(screen.getByText(/suspended/i)).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("AC3: active user sees textarea form", async () => {
    mockUserStatus.mockReturnValue("active");
    render(<CommentForm articleId="a1" />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("AC3: submit calls POST /api/comments and shows pending notice", async () => {
    mockUserStatus.mockReturnValue("active");
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ id: "c1" }) });
    render(<CommentForm articleId="a1" />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Hello world" } });
    fireEvent.click(screen.getByRole("button", { name: /post comment/i }));
    await waitFor(() => expect(screen.getByRole("status")).toBeInTheDocument());
    expect(screen.getByRole("status").textContent).toMatch(/awaiting approval/i);
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/comments",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("AC3: form is cleared after successful submit", async () => {
    mockUserStatus.mockReturnValue("active");
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ id: "c1" }) });
    render(<CommentForm articleId="a1" />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "My comment" } });
    fireEvent.click(screen.getByRole("button", { name: /post comment/i }));
    await waitFor(() => expect(screen.getByRole("status")).toBeInTheDocument());
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("pending notice is reset on a second submission", async () => {
    mockUserStatus.mockReturnValue("active");
    mockFetch
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ id: "c1" }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ id: "c2" }) });
    render(<CommentForm articleId="a1" />);
    // first submit
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "First" } });
    fireEvent.click(screen.getByRole("button", { name: /post comment/i }));
    await waitFor(() => expect(screen.getByRole("status")).toBeInTheDocument());
    // second submit — notice should disappear momentarily
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Second" } });
    fireEvent.click(screen.getByRole("button", { name: /post comment/i }));
    // while in flight the status is gone
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("status")).toBeInTheDocument());
  });

  it("AC7: 429 with hourly reason shows hourly message", async () => {
    mockUserStatus.mockReturnValue("active");
    mockFetch.mockResolvedValueOnce({
      ok: false, status: 429, json: async () => ({ reason: "hourly" }),
    });
    render(<CommentForm articleId="a1" />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Test" } });
    fireEvent.click(screen.getByRole("button", { name: /post comment/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByRole("alert").textContent).toMatch(/too many times/i);
  });

  it("EC3: 429 with pending_cap shows cap message", async () => {
    mockUserStatus.mockReturnValue("active");
    mockFetch.mockResolvedValueOnce({
      ok: false, status: 429, json: async () => ({ reason: "pending_cap" }),
    });
    render(<CommentForm articleId="a1" />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Test" } });
    fireEvent.click(screen.getByRole("button", { name: /post comment/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByRole("alert").textContent).toMatch(/waiting for approval/i);
  });

  it("generic error on non-ok response", async () => {
    mockUserStatus.mockReturnValue("active");
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
    render(<CommentForm articleId="a1" />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Test" } });
    fireEvent.click(screen.getByRole("button", { name: /post comment/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByRole("alert").textContent).toMatch(/could not post/i);
  });

  it("loading state: returns null while resolving user", () => {
    mockUserStatus.mockReturnValue("loading");
    const { container } = render(<CommentForm articleId="a1" />);
    expect(container.firstChild).toBeNull();
  });
});
