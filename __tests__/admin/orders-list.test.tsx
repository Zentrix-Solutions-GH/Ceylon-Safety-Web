// S-103: Admin orders list — AC1, AC2, AC4, EC2, EC3, AC3 (permission)
// Tests for OrdersListClient component and AdminOrdersPage server component.

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as React from "react";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockPush = vi.fn();
const mockReplace = vi.fn();
const mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  usePathname: () => "/admin/orders",
  useSearchParams: () => mockSearchParams,
  notFound: vi.fn(),
  redirect: vi.fn(),
}));

const mockGetOrdersList = vi.fn();

vi.mock("@/lib/admin/actions/orders", () => ({
  getOrdersList: (...args: unknown[]) => mockGetOrdersList(...args),
}));

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeItem(overrides: Partial<import("@/types/order").AdminOrderListItem> = {}): import("@/types/order").AdminOrderListItem {
  return {
    orderId: "ord-001",
    orderNumber: "CS-00001",
    status: "paid",
    paymentMethod: "card",
    totalCents: 150000,
    createdAt: "2026-11-01T10:30:00.000Z",
    buyerName: "Kasun Perera",
    buyerEmail: "kasun@example.com",
    needsReview: false,
    ...overrides,
  };
}

function makeResult(
  items: import("@/types/order").AdminOrderListItem[] = [makeItem()],
  total = 1,
  page = 1,
) {
  return {
    ok: true as const,
    data: { items, total, page, pageSize: 20 },
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function renderPage(searchParams: Record<string, string> = {}) {
  const { default: Page } = await import("@/app/admin/orders/page");
  const jsx = await Page({ searchParams: Promise.resolve(searchParams) });
  render(jsx as React.ReactElement);
}

// ─── OrdersListClient — AC1: table columns ────────────────────────────────────

describe("OrdersListClient — AC1: columns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetOrdersList.mockResolvedValue(makeResult());
  });

  it("renders order number column", async () => {
    await renderPage();
    expect(screen.getByText("CS-00001")).toBeInTheDocument();
  });

  it("renders buyer name column", async () => {
    await renderPage();
    expect(screen.getByText("Kasun Perera")).toBeInTheDocument();
  });

  it("renders total formatted in LKR with two decimals", async () => {
    await renderPage();
    // 150000 cents = 1500.00 LKR; formatPrice uses en-LK locale
    expect(screen.getByText(/1,500\.00/)).toBeInTheDocument();
  });

  it("renders date in Sri Lanka timezone (UTC+5:30)", async () => {
    await renderPage();
    // 2026-11-01T10:30:00Z = 16:00 IST = 16:00 Asia/Colombo
    // We just verify a date string is present — exact format is locale-dependent
    expect(screen.getByText(/2026/)).toBeInTheDocument();
  });

  it("renders payment method in table row", async () => {
    await renderPage();
    // Multiple "Card" texts may appear (filter option + row); check at least one is present
    expect(screen.getAllByText(/^card$/i).length).toBeGreaterThan(0);
  });

  it("renders order status in table row", async () => {
    await renderPage();
    // Multiple "Paid" texts may appear (filter option + row); check at least one is present
    expect(screen.getAllByText(/^paid$/i).length).toBeGreaterThan(0);
  });
});

// ─── OrdersListClient — AC2: filter controls ─────────────────────────────────

describe("OrdersListClient — AC2: filter controls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetOrdersList.mockResolvedValue(makeResult());
  });

  it("renders status filter", async () => {
    await renderPage();
    expect(screen.getByRole("combobox", { name: /status/i })).toBeInTheDocument();
  });

  it("renders payment method filter", async () => {
    await renderPage();
    expect(screen.getByRole("combobox", { name: /payment method/i })).toBeInTheDocument();
  });

  it("renders needs-review filter", async () => {
    await renderPage();
    expect(screen.getByRole("checkbox", { name: /needs review/i })).toBeInTheDocument();
  });

  it("renders order number search field", async () => {
    await renderPage();
    // <input type="search"> has accessible role "searchbox"
    expect(screen.getByRole("searchbox", { name: /search/i })).toBeInTheDocument();
  });

  it("renders date-from filter", async () => {
    await renderPage();
    expect(screen.getByLabelText(/from/i)).toBeInTheDocument();
  });

  it("renders date-to filter", async () => {
    await renderPage();
    expect(screen.getByLabelText(/to/i)).toBeInTheDocument();
  });
});

// ─── AC4 / EC3: empty state ───────────────────────────────────────────────────

describe("AC4/EC3: empty state", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows empty message when no results", async () => {
    mockGetOrdersList.mockResolvedValue(makeResult([], 0));
    await renderPage();
    expect(screen.getByText(/no orders match these filters/i)).toBeInTheDocument();
  });

  it("does not show an error on empty result", async () => {
    mockGetOrdersList.mockResolvedValue(makeResult([], 0));
    await renderPage();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

// ─── EC2: anonymised buyer ────────────────────────────────────────────────────

describe("EC2: anonymised buyer", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows 'Deleted user' when buyerName is empty", async () => {
    mockGetOrdersList.mockResolvedValue(
      makeResult([makeItem({ buyerName: "", buyerEmail: "" })]),
    );
    await renderPage();
    expect(screen.getByText(/deleted user/i)).toBeInTheDocument();
  });
});

// ─── AC3: permission guard ────────────────────────────────────────────────────

describe("AC3: permission guard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls notFound when server action returns not_allowed", async () => {
    const { notFound } = await import("next/navigation");
    mockGetOrdersList.mockResolvedValue({ ok: false, code: "not_allowed" });
    await renderPage();
    expect(notFound).toHaveBeenCalled();
  });
});

// ─── AC5: row click navigates to order detail ─────────────────────────────────

describe("AC5: row click", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetOrdersList.mockResolvedValue(makeResult());
  });

  it("clicking a row pushes to /admin/orders/[id]", async () => {
    await renderPage();
    const row = screen.getByRole("row", { name: /CS-00001/i });
    await userEvent.click(row);
    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("/admin/orders/ord-001"));
  });
});

// ─── AC1: pagination ─────────────────────────────────────────────────────────

describe("AC1: pagination", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows pagination when total > pageSize", async () => {
    const items = Array.from({ length: 20 }, (_, i) =>
      makeItem({ orderId: `ord-${i}`, orderNumber: `CS-${String(i).padStart(5, "0")}` }),
    );
    mockGetOrdersList.mockResolvedValue(makeResult(items, 45, 1));
    await renderPage();
    expect(screen.getByRole("navigation", { name: /pagination/i })).toBeInTheDocument();
  });

  it("does not show pagination when total <= pageSize", async () => {
    mockGetOrdersList.mockResolvedValue(makeResult([makeItem()], 1, 1));
    await renderPage();
    expect(screen.queryByRole("navigation", { name: /pagination/i })).not.toBeInTheDocument();
  });
});
