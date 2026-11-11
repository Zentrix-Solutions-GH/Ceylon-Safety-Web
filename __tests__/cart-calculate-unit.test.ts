// S-075: Direct unit tests for lib/cart/calculate.ts
// These tests exercise the DB query logic, available/unavailable branching,
// and subtotal accumulation independently from the route layer.

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/media/publicUrl", () => ({
  publicUrl: (key: string) => `https://cdn.example.com/${key}`,
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

import { calculateCart } from "@/lib/cart/calculate";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const mockCreateClient = vi.mocked(createSupabaseServerClient);
const mockSupabaseFrom = vi.fn();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeDoc(overrides: Record<string, unknown> = {}) {
  return {
    id: "doc-1",
    title: "Safety Sign EN",
    slug: "safety-sign",
    cover_image_key: "covers/doc-1.jpg",
    price_cents: 2500,
    page_count: 10,
    status: "published",
    deleted_at: null,
    ...overrides,
  };
}

function makeFile(overrides: Record<string, unknown> = {}) {
  return {
    document_id: "doc-1",
    language: "en",
    kind: "full",
    status: "ready",
    is_current: true,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCreateClient.mockResolvedValue({ from: mockSupabaseFrom } as never);
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("calculateCart", () => {
  it("happy path: one available item → correct price and subtotal", async () => {
    const doc = makeDoc();
    const file = makeFile();

    // cart_items query
    const cartItemsResult = { data: [{ id: "ci-1", document_id: "doc-1", language: "en" }], error: null };
    // documents query
    const docsResult = { data: [doc], error: null };
    // document_files query
    const filesResult = { data: [file], error: null };

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "cart_items") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue(cartItemsResult),
          }),
        };
      }
      if (table === "documents") {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue(docsResult),
              }),
            }),
          }),
        };
      }
      if (table === "document_files") {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockResolvedValue(filesResult),
                }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const result = await calculateCart("user-1");

    expect(result.items).toHaveLength(1);
    expect(result.items[0].available).toBe(true);
    expect(result.items[0].price).toBe(2500);
    expect(result.items[0].coverUrl).toBe("https://cdn.example.com/covers/doc-1.jpg");
    expect(result.subtotal).toBe(2500);
    expect(result.total).toBe(2500);
  });

  it("EC2: language file missing → language_unavailable, price=0, excluded from subtotal", async () => {
    const doc = makeDoc();
    const cartItemsResult = { data: [{ id: "ci-1", document_id: "doc-1", language: "si" }], error: null };
    const docsResult = { data: [doc], error: null };
    // No matching si file
    const filesResult = { data: [], error: null };

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "cart_items") {
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue(cartItemsResult) }) };
      }
      if (table === "documents") {
        return { select: vi.fn().mockReturnValue({ in: vi.fn().mockReturnValue({ is: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue(docsResult) }) }) }) };
      }
      if (table === "document_files") {
        return { select: vi.fn().mockReturnValue({ in: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue(filesResult) }) }) }) }) };
      }
      return {};
    });

    const result = await calculateCart("user-1");

    expect(result.items).toHaveLength(1);
    expect(result.items[0].available).toBe(false);
    expect(result.items[0].unavailableReason).toBe("language_unavailable");
    expect(result.items[0].price).toBe(0);
    expect(result.subtotal).toBe(0);
  });

  it("EC1: document unpublished → document_unavailable, price=0, excluded from subtotal", async () => {
    const cartItemsResult = { data: [{ id: "ci-1", document_id: "doc-1", language: "en" }], error: null };
    // DB filters status=published, so draft docs are absent from the result
    const docsResult = { data: [], error: null };
    const filesResult = { data: [], error: null };

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "cart_items") {
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue(cartItemsResult) }) };
      }
      if (table === "documents") {
        return { select: vi.fn().mockReturnValue({ in: vi.fn().mockReturnValue({ is: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue(docsResult) }) }) }) };
      }
      if (table === "document_files") {
        return { select: vi.fn().mockReturnValue({ in: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue(filesResult) }) }) }) }) };
      }
      return {};
    });

    const result = await calculateCart("user-1");

    expect(result.items[0].available).toBe(false);
    expect(result.items[0].unavailableReason).toBe("document_unavailable");
    expect(result.subtotal).toBe(0);
  });

  it("buyNow bypass: skips cart query, returns single item priced correctly", async () => {
    const doc = makeDoc();
    const docsResult = { data: [doc], error: null };
    const filesResult = { data: [makeFile()], error: null };

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "documents") {
        return { select: vi.fn().mockReturnValue({ in: vi.fn().mockReturnValue({ is: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue(docsResult) }) }) }) };
      }
      if (table === "document_files") {
        return { select: vi.fn().mockReturnValue({ in: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue(filesResult) }) }) }) }) };
      }
      return {};
    });

    const result = await calculateCart("user-1", { documentId: "doc-1", language: "en" });

    // cart_items table should NOT be queried in buyNow mode
    const cartCallArgs = (mockSupabaseFrom.mock.calls as string[][]).flat();
    expect(cartCallArgs).not.toContain("cart_items");

    expect(result.items).toHaveLength(1);
    expect(result.items[0].available).toBe(true);
    expect(result.items[0].price).toBe(2500);
    expect(result.subtotal).toBe(2500);
  });

  it("empty cart: returns empty items and zero totals without querying documents", async () => {
    mockSupabaseFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    }));

    const result = await calculateCart("user-1");

    expect(result.items).toHaveLength(0);
    expect(result.subtotal).toBe(0);
    expect(result.total).toBe(0);
    // Should short-circuit before querying documents
    const calls = (mockSupabaseFrom.mock.calls as string[][]).flat();
    expect(calls).not.toContain("documents");
  });
});
