// S-102: Admin Today page — AC1, AC2, AC4, AC5, EC1, EC2
// ActionResult<AdminTodayResult> success shape: { ok: true } & AdminTodayResult
// (fields spread directly on the object, not nested under .value)

import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as React from "react";
import { axe, toHaveNoViolations } from "jest-axe";

expect.extend(toHaveNoViolations);

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockGetAdminToday = vi.fn();

// page.tsx imports getAdminTodayCached from ./today-cache
vi.mock("@/app/admin/today-cache", () => ({
  getAdminTodayCached: (...args: unknown[]) => mockGetAdminToday(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/admin",
  redirect: vi.fn(),
}));

vi.mock("next/cache", () => ({
  unstable_noStore: vi.fn(),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function renderPage() {
  const { default: Page } = await import("@/app/admin/page");
  const jsx = await Page();
  render(jsx as React.ReactElement);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

// ─── AC4: no-cache export ─────────────────────────────────────────────────────

describe("AC4: page is not statically cached", () => {
  it("exports dynamic = force-dynamic", async () => {
    const mod = await import("@/app/admin/page");
    expect((mod as Record<string, unknown>).dynamic).toBe("force-dynamic");
  });
});

// ─── AC1: Today list lines ────────────────────────────────────────────────────

describe("AC1: renders Today list lines from getAdminToday", () => {
  it("shows comments waiting line when present", async () => {
    mockGetAdminToday.mockResolvedValue({
      ok: true,
      comments: { count: 3, oldestAt: "2026-11-20T08:00:00Z" },
    });
    await renderPage();
    expect(screen.getByText(/Comments waiting/i)).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("shows bank slips line with needsSecondApproval when present", async () => {
    mockGetAdminToday.mockResolvedValue({
      ok: true,
      bankSlips: { count: 5, oldestAt: "2026-11-20T08:00:00Z", needsSecondApproval: 2 },
    });
    await renderPage();
    expect(screen.getByText(/Bank transfers waiting/i)).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText(/need second approval/i)).toBeInTheDocument();
  });

  it("shows download requests line when present", async () => {
    mockGetAdminToday.mockResolvedValue({
      ok: true,
      downloadRequests: { count: 1, oldestAt: "2026-11-20T08:00:00Z" },
    });
    await renderPage();
    expect(screen.getByText(/Download requests waiting/i)).toBeInTheDocument();
  });

  it("shows orders needing review line when present", async () => {
    mockGetAdminToday.mockResolvedValue({
      ok: true,
      ordersNeedingReview: { count: 4, oldestAt: "2026-11-20T08:00:00Z" },
    });
    await renderPage();
    expect(screen.getByText(/Orders needing review/i)).toBeInTheDocument();
  });

  it("shows today's orders line when present", async () => {
    mockGetAdminToday.mockResolvedValue({
      ok: true,
      todayOrders: { count: 7, grossCents: 350000 },
    });
    await renderPage();
    expect(screen.getByText(/Today's orders/i)).toBeInTheDocument();
    expect(screen.getByText(/3,500\.00/)).toBeInTheDocument();
  });

  it("shows all queue lines with View queue buttons", async () => {
    mockGetAdminToday.mockResolvedValue({
      ok: true,
      comments: { count: 1, oldestAt: "2026-11-20T08:00:00Z" },
      bankSlips: { count: 2, oldestAt: "2026-11-20T08:00:00Z", needsSecondApproval: 0 },
      downloadRequests: { count: 1, oldestAt: "2026-11-20T08:00:00Z" },
      ordersNeedingReview: { count: 3, oldestAt: "2026-11-20T08:00:00Z" },
      todayOrders: { count: 10, grossCents: 100000 },
    });
    await renderPage();
    const viewQueueLinks = screen.getAllByRole("link", { name: /View queue/i });
    expect(viewQueueLinks.length).toBeGreaterThanOrEqual(4);
  });
});

// ─── AC2: permission-filtered lines ──────────────────────────────────────────

describe("AC2: lines not in result are not rendered; empty state shown", () => {
  it("does not render comments line when absent from result", async () => {
    mockGetAdminToday.mockResolvedValue({
      ok: true,
      todayOrders: { count: 1, grossCents: 1000 },
    });
    await renderPage();
    expect(screen.queryByText(/Comments waiting/i)).not.toBeInTheDocument();
  });

  it("shows empty state when result has no queue lines", async () => {
    mockGetAdminToday.mockResolvedValue({ ok: true });
    await renderPage();
    expect(screen.getByText(/Nothing is waiting\. Well done\./i)).toBeInTheDocument();
  });

  it("empty state not shown when at least one line exists", async () => {
    mockGetAdminToday.mockResolvedValue({
      ok: true,
      comments: { count: 1, oldestAt: null },
    });
    await renderPage();
    expect(screen.queryByText(/Nothing is waiting/i)).not.toBeInTheDocument();
  });
});

// ─── AC4 / EC2: error mapping ─────────────────────────────────────────────────

describe("AC4/EC2: error codes map to plain sentences", () => {
  it.each([
    ["mfa_required", /Enter the code from your authenticator app/i],
    ["reauth_required", /Please sign in again/i],
    ["rate_limited", /Too many requests/i],
    ["not_allowed", /Could not load the Today list/i],
  ])("maps error code %s to message", async (code, pattern) => {
    mockGetAdminToday.mockResolvedValue({ ok: false, code });
    await renderPage();
    expect(screen.getByText(pattern)).toBeInTheDocument();
  });

  it("shows retry link on error", async () => {
    mockGetAdminToday.mockResolvedValue({ ok: false, code: "rate_limited" });
    await renderPage();
    expect(screen.getByRole("link", { name: /Try again/i })).toBeInTheDocument();
  });

  it("shows error message on thrown exception", async () => {
    mockGetAdminToday.mockRejectedValue(new Error("network"));
    await renderPage();
    expect(screen.getByText(/Could not load the Today list/i)).toBeInTheDocument();
  });
});

// ─── EC1: role with one permission ───────────────────────────────────────────

describe("EC1: a caller with one permission sees only that line", () => {
  it("shows only bank slips line when that is the only returned field", async () => {
    mockGetAdminToday.mockResolvedValue({
      ok: true,
      bankSlips: { count: 1, oldestAt: "2026-11-20T08:00:00Z", needsSecondApproval: 0 },
    });
    await renderPage();
    expect(screen.getByText(/Bank transfers waiting/i)).toBeInTheDocument();
    expect(screen.queryByText(/Comments waiting/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Download requests waiting/i)).not.toBeInTheDocument();
  });
});

// ─── AC5: accessibility ───────────────────────────────────────────────────────

describe("AC5: no axe violations (WCAG 2.1 AA target)", () => {
  it("full Today list has no axe violations", async () => {
    mockGetAdminToday.mockResolvedValue({
      ok: true,
      comments: { count: 2, oldestAt: "2026-11-20T08:00:00Z" },
      bankSlips: { count: 1, oldestAt: "2026-11-20T08:00:00Z", needsSecondApproval: 1 },
      downloadRequests: { count: 3, oldestAt: "2026-11-20T08:00:00Z" },
      ordersNeedingReview: { count: 1, oldestAt: "2026-11-20T08:00:00Z" },
      todayOrders: { count: 5, grossCents: 150000 },
    });
    const { default: Page } = await import("@/app/admin/page");
    const jsx = await Page();
    const { container } = render(jsx as React.ReactElement);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("empty state has no axe violations", async () => {
    mockGetAdminToday.mockResolvedValue({ ok: true });
    const { default: Page } = await import("@/app/admin/page");
    const jsx = await Page();
    const { container } = render(jsx as React.ReactElement);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("error state has no axe violations", async () => {
    mockGetAdminToday.mockResolvedValue({ ok: false, code: "rate_limited" });
    const { default: Page } = await import("@/app/admin/page");
    const jsx = await Page();
    const { container } = render(jsx as React.ReactElement);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
