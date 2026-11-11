import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ArticleLikeButton } from "@/components/articles/ArticleLikeButton";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mockPush }) }));

const mockGetUser = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({ auth: { getUser: mockGetUser } }),
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function makeUser(accountStatus?: string) {
  return {
    data: {
      user: accountStatus !== undefined
        ? { user_metadata: { account_status: accountStatus } }
        : null,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ArticleLikeButton", () => {
  it("AC1: shows initial count", () => {
    mockGetUser.mockResolvedValue(makeUser());
    render(<ArticleLikeButton articleId="a1" slug="test" initialCount={5} />);
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("AC1: shows unfilled heart when not liked", async () => {
    mockGetUser.mockResolvedValue(makeUser("active"));
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ liked: false, count: 5 }) });
    render(<ArticleLikeButton articleId="a1" slug="test" initialCount={5} />);
    await waitFor(() => expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "false"));
  });

  it("AC1: optimistic toggle — count increments before server responds", async () => {
    mockGetUser.mockResolvedValue(makeUser("active"));
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ liked: false, count: 3 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ liked: true, count: 4 }) });
    render(<ArticleLikeButton articleId="a1" slug="test" initialCount={3} />);
    await waitFor(() => expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "false"));
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(screen.getByText("4")).toBeInTheDocument());
  });

  it("AC2: signed-out click redirects to sign-in", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    render(<ArticleLikeButton articleId="a1" slug="my-slug" initialCount={0} />);
    await waitFor(() => expect(screen.getByRole("button")).not.toBeDisabled());
    fireEvent.click(screen.getByRole("button"));
    expect(mockPush).toHaveBeenCalledWith("/sign-in?next=/articles/my-slug");
  });

  it("EC2: network error reverts state and shows error", async () => {
    mockGetUser.mockResolvedValue(makeUser("active"));
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ liked: false, count: 2 }) })
      .mockRejectedValueOnce(new Error("Network error"));
    render(<ArticleLikeButton articleId="a1" slug="test" initialCount={2} />);
    await waitFor(() => expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "false"));
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("EC2: non-ok response reverts and shows error", async () => {
    mockGetUser.mockResolvedValue(makeUser("active"));
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ liked: false, count: 1 }) })
      .mockResolvedValueOnce({ ok: false });
    render(<ArticleLikeButton articleId="a1" slug="test" initialCount={1} />);
    await waitFor(() => expect(screen.getByRole("button")).not.toBeDisabled());
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
  });

  it("button is disabled while loading", () => {
    mockGetUser.mockReturnValue(new Promise(() => {}));
    render(<ArticleLikeButton articleId="a1" slug="test" initialCount={0} />);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("suspended user button is enabled (server enforces the restriction)", async () => {
    mockGetUser.mockResolvedValue(makeUser("suspended"));
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ liked: false, count: 0 }) });
    render(<ArticleLikeButton articleId="a1" slug="test" initialCount={0} />);
    await waitFor(() => expect(screen.getByRole("button")).not.toBeDisabled());
    expect(screen.getByRole("button")).not.toBeDisabled();
  });

  it("AC1: unlike decrements count", async () => {
    mockGetUser.mockResolvedValue(makeUser("active"));
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ liked: true, count: 5 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ liked: false, count: 4 }) });
    render(<ArticleLikeButton articleId="a1" slug="test" initialCount={5} />);
    await waitFor(() => expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true"));
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(screen.getByText("4")).toBeInTheDocument());
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "false");
  });
});
