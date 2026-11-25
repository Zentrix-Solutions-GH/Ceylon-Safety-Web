// S-102: Admin Today badges — AC3, EC3

import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import * as React from "react";
import AdminSidebar from "@/app/admin/AdminSidebar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin",
  useRouter: () => ({ push: vi.fn() }),
}));

afterEach(() => {
  vi.useRealTimers();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

type BadgeCounts = { comments: number; bankTransfers: number; downloadRequests: number };
type BadgeOldestAt = { comments?: string; bankTransfers?: string; downloadRequests?: string };

function renderSidebar(
  badgeCounts: BadgeCounts,
  ordersNeedingReview = false,
  badgeOldestAt?: BadgeOldestAt
) {
  render(
    <AdminSidebar
      role="admin"
      badgeCounts={badgeCounts}
      ordersNeedingReview={ordersNeedingReview}
      badgeOldestAt={badgeOldestAt}
      open={true}
      onClose={vi.fn()}
    />
  );
}

// ─── AC3: badge counts ────────────────────────────────────────────────────────

describe("AC3: badge counts in sidebar", () => {
  it("shows comments count badge when > 0", () => {
    renderSidebar({ comments: 5, bankTransfers: 0, downloadRequests: 0 });
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("does not show badge when count is 0", () => {
    renderSidebar({ comments: 0, bankTransfers: 0, downloadRequests: 0 });
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("shows orders needs-review dot when ordersNeedingReview is true", () => {
    renderSidebar({ comments: 0, bankTransfers: 0, downloadRequests: 0 }, true);
    expect(screen.getByRole("img", { name: /orders need review/i })).toBeInTheDocument();
  });

  it("does not show orders dot when ordersNeedingReview is false", () => {
    renderSidebar({ comments: 0, bankTransfers: 0, downloadRequests: 0 }, false);
    expect(screen.queryByRole("img", { name: /orders need review/i })).not.toBeInTheDocument();
  });
});

// ─── EC3: 99+ cap ────────────────────────────────────────────────────────────

describe("EC3: counts above 99 show 99+", () => {
  it("shows 99+ when count is 100", () => {
    renderSidebar({ comments: 100, bankTransfers: 0, downloadRequests: 0 });
    expect(screen.getByText("99+")).toBeInTheDocument();
  });

  it("shows 99 when count is exactly 99", () => {
    renderSidebar({ comments: 99, bankTransfers: 0, downloadRequests: 0 });
    expect(screen.getByText("99")).toBeInTheDocument();
  });

  it("shows 99+ when count is 1000", () => {
    renderSidebar({ comments: 1000, bankTransfers: 0, downloadRequests: 0 });
    expect(screen.getByText("99+")).toBeInTheDocument();
  });
});

// ─── AC3: age tooltip ────────────────────────────────────────────────────────

describe("AC3: oldest age shown on badge hover", () => {
  it("badge title shows formatted age for a known timestamp", () => {
    // 2026-11-24T08:00:00Z is exactly 28h before 2026-11-25T12:00:00Z
    vi.setSystemTime(new Date("2026-11-25T12:00:00Z"));
    renderSidebar(
      { comments: 3, bankTransfers: 0, downloadRequests: 0 },
      false,
      { comments: "2026-11-24T08:00:00Z" }
    );
    const badge = screen.getByText("3");
    expect(badge).toHaveAttribute("title");
    expect(badge.getAttribute("title")).toContain("1d ago");
  });

  it("badge has no title attribute when no oldestAt is provided", () => {
    renderSidebar({ comments: 3, bankTransfers: 0, downloadRequests: 0 });
    const badge = screen.getByText("3");
    expect(badge.getAttribute("title")).toBeNull();
  });
});
