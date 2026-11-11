import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CommentThread } from "@/components/articles/CommentThread";
import type { Comment, CommentCursor } from "@/types/comment";

const mockGetUser = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({ auth: { getUser: mockGetUser } }),
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function makeComment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: "c1",
    articleId: "a1",
    author: { displayName: "Alice", isStaff: false },
    body: "Hello world",
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CommentThread", () => {
  it("AC5: renders approved comments", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const comments = [makeComment({ body: "First comment" })];
    render(
      <CommentThread articleId="a1" initialComments={comments} initialNextCursor={null} />,
    );
    expect(screen.getByText("First comment")).toBeInTheDocument();
  });

  it("AC8: comment body is rendered as plain text, not HTML", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const comments = [makeComment({ body: "<script>alert(1)</script>" })];
    render(
      <CommentThread articleId="a1" initialComments={comments} initialNextCursor={null} />,
    );
    expect(screen.queryByRole("script")).not.toBeInTheDocument();
    expect(screen.getByText("<script>alert(1)</script>")).toBeInTheDocument();
  });

  it("AC5: shows Load more button when nextCursor is set", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const cursor: CommentCursor = { createdAt: "2026-01-01T00:00:00Z", id: "c1" };
    render(
      <CommentThread articleId="a1" initialComments={[makeComment()]} initialNextCursor={cursor} />,
    );
    expect(screen.getByRole("button", { name: /load more/i })).toBeInTheDocument();
  });

  it("AC5: Load more appends comments", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const cursor: CommentCursor = { createdAt: "2026-01-01T00:00:00Z", id: "c1" };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        comments: [makeComment({ id: "c2", body: "Second comment" })],
        nextCursor: null,
      }),
    });
    render(
      <CommentThread articleId="a1" initialComments={[makeComment()]} initialNextCursor={cursor} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /load more/i }));
    await waitFor(() => expect(screen.getByText("Second comment")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /load more/i })).not.toBeInTheDocument();
  });

  it("AC6: active user sees their pending comment above the thread", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { user_metadata: { account_status: "active" } } },
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        comments: [{ id: "p1", body: "My pending comment", status: "pending", createdAt: "2026-01-02T00:00:00Z" }],
      }),
    });
    render(
      <CommentThread articleId="a1" initialComments={[]} initialNextCursor={null} />,
    );
    await waitFor(() => expect(screen.getByText("My pending comment")).toBeInTheDocument());
    expect(screen.getByText(/waiting for approval/i)).toBeInTheDocument();
  });

  it("staff badge shown for staff comment", () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const comments = [makeComment({ author: { displayName: "Staff User", isStaff: true } })];
    render(
      <CommentThread articleId="a1" initialComments={comments} initialNextCursor={null} />,
    );
    expect(screen.getByText("Staff User")).toBeInTheDocument();
    expect(screen.getByText("Admin")).toBeInTheDocument(); // staff badge label
  });

  it("shows empty signed-out message when no comments and user is signed out", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    render(
      <CommentThread articleId="a1" initialComments={[]} initialNextCursor={null} />,
    );
    await waitFor(() => expect(screen.getByText(/sign in to comment/i)).toBeInTheDocument());
  });

  it("shows empty signed-in message when no comments and user is active", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { user_metadata: { account_status: "active" } } },
    });
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ comments: [] }) });
    render(
      <CommentThread articleId="a1" initialComments={[]} initialNextCursor={null} />,
    );
    await waitFor(() => expect(screen.getByText(/be the first/i)).toBeInTheDocument());
  });

  it("AC8: links in comment body are not rendered as anchors", () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const comments = [makeComment({ body: "Visit https://example.com for more" })];
    render(
      <CommentThread articleId="a1" initialComments={comments} initialNextCursor={null} />,
    );
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("Visit https://example.com for more")).toBeInTheDocument();
  });
});
