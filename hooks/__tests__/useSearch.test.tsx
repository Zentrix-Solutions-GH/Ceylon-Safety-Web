import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fetch globally
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

import { useSearch } from "@/hooks/useSearch";

function makeResponse(items: unknown[], status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify({ items }), {
      status,
      headers: { "content-type": "application/json" },
    })
  );
}

function makeErrorResponse(code: string, status: number) {
  return Promise.resolve(
    new Response(JSON.stringify({ error: code }), {
      status,
      headers: { "content-type": "application/json" },
    })
  );
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe("useSearch", () => {
  it("AC9: initial state is idle with no items", () => {
    const { result } = renderHook(() => useSearch());
    expect(result.current.status).toBe("idle");
    expect(result.current.items).toEqual([]);
  });

  it("AC9: returns results on successful search", async () => {
    const items = [
      { kind: "article", id: "a1", slug: "s", title: "T", shortText: "x", coverImageKey: null, categoryName: null },
    ];
    mockFetch.mockResolvedValueOnce(makeResponse(items));

    const { result } = renderHook(() => useSearch());
    act(() => {
      result.current.search("fire", "home");
    });

    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.items).toEqual(items);
  });

  it("AC9/EC3: older request is cancelled when a newer one starts", async () => {
    let resolveFirst!: (v: Response) => void;
    const firstResponse = new Promise<Response>((r) => { resolveFirst = r; });
    const secondItems = [
      { kind: "article", id: "a2", slug: "s2", title: "T2", shortText: "y", coverImageKey: null, categoryName: null },
    ];

    mockFetch.mockReturnValueOnce(firstResponse);
    mockFetch.mockResolvedValueOnce(makeResponse(secondItems));

    const { result } = renderHook(() => useSearch());

    act(() => { result.current.search("first", "home"); });
    act(() => { result.current.search("second", "home"); });

    // Resolve the first (stale) fetch after second starts
    act(() => {
      resolveFirst(
        new Response(JSON.stringify({ items: [{ kind: "article", id: "a1", slug: "s1", title: "T1", shortText: "x", coverImageKey: null, categoryName: null }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      );
    });

    await waitFor(() => expect(result.current.status).toBe("success"));
    // Should show second results, not first
    expect(result.current.items).toEqual(secondItems);
  });

  it("sets status to rate_limited on 429", async () => {
    mockFetch.mockResolvedValueOnce(makeErrorResponse("rate_limited", 429));

    const { result } = renderHook(() => useSearch());
    act(() => { result.current.search("test", "home"); });

    await waitFor(() => expect(result.current.status).toBe("rate_limited"));
    expect(result.current.items).toEqual([]);
  });

  it("sets status to error on 500", async () => {
    mockFetch.mockResolvedValueOnce(makeErrorResponse("unknown", 500));

    const { result } = renderHook(() => useSearch());
    act(() => { result.current.search("test", "home"); });

    await waitFor(() => expect(result.current.status).toBe("error"));
  });
});
