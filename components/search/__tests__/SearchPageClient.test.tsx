import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/config.public", () => ({
  publicConfig: {
    mediaCdnUrl: "https://cdn.test.example.com",
    supabaseUrl: "https://test.supabase.co",
    supabaseAnonKey: "test-anon-key",
    appUrl: "https://test.example.com",
    turnstileSiteKey: "1x00000000000000000000AA",
  },
}));

// useSearchParams returns different values per test via mockReturnValue below
const mockGet = vi.fn();
vi.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: mockGet }),
  useRouter: () => ({ push: vi.fn() }),
}));

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

function makeOkResponse(items: unknown[] = []) {
  return Promise.resolve(
    new Response(JSON.stringify({ items }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })
  );
}

import { SearchPageClient } from "@/components/search/SearchPageClient";

function setup(q: string, scope = "home") {
  mockGet.mockImplementation((key: string) => {
    if (key === "q") return q;
    if (key === "scope") return scope;
    return null;
  });
}

beforeEach(() => {
  mockFetch.mockReset();
  mockGet.mockReset();
});

describe("SearchPageClient", () => {
  it("EC4: re-runs search when q changes (simulates browser back navigation)", async () => {
    setup("fire");
    mockFetch.mockResolvedValueOnce(makeOkResponse());

    const { rerender } = render(<SearchPageClient />);
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    expect(mockFetch.mock.calls[0][0]).toContain("q=fire");

    // Simulate browser back — URL changes to a new query
    setup("safety");
    mockFetch.mockResolvedValueOnce(makeOkResponse());
    rerender(<SearchPageClient />);

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
    expect(mockFetch.mock.calls[1][0]).toContain("q=safety");
  });

  it("EC5: skeleton is shown while fetch is in-flight, then results appear", async () => {
    setup("fire");

    let resolve!: (v: Response) => void;
    const pending = new Promise<Response>((r) => { resolve = r; });
    mockFetch.mockReturnValueOnce(pending);

    render(<SearchPageClient />);

    // Skeleton visible immediately after search starts
    expect(screen.getByRole("status")).toBeInTheDocument();

    // Resolve the fetch → results appear (empty list → "No results found.")
    resolve(
      new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );

    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
    expect(screen.getByText("No results found.")).toBeInTheDocument();
  });

  it("empty q shows prompt and makes no request", () => {
    setup("");
    render(<SearchPageClient />);
    expect(mockFetch).not.toHaveBeenCalled();
    expect(screen.getByText(/enter a search term/i)).toBeInTheDocument();
  });

  it("AC7: unknown scope falls back to home in the fetch URL", async () => {
    setup("fire", "unknown-scope");
    mockFetch.mockResolvedValueOnce(makeOkResponse());
    render(<SearchPageClient />);
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    expect(mockFetch.mock.calls[0][0]).toContain("scope=home");
  });
});
