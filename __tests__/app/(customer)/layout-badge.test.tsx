// S-091 AC8: integration test — CustomerLayout threads cartCount to CustomerHeader
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

const mockGetCurrentUserCached = vi.fn();
vi.mock("@/app/(customer)/user-cache", () => ({
  getCurrentUserCached: (...args: unknown[]) => mockGetCurrentUserCached(...args),
}));

const mockGetCartCount = vi.fn();
vi.mock("@/lib/cart/count", () => ({
  getCartCount: (...args: unknown[]) => mockGetCartCount(...args),
}));

vi.mock("@/messages/en", () => ({
  t: (key: string, params?: Record<string, string>) => {
    if (params?.count) return `${key}:${params.count}`;
    return key;
  },
  errorMessage: (code: string) => code,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: null, isLoading: false, signOut: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

import CustomerLayout from "@/app/(customer)/layout";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CustomerLayout — AC8: cart count badge chain", () => {
  it("passes cartCount from getCartCount to CustomerHeader when user is signed in", async () => {
    mockGetCurrentUserCached.mockResolvedValue({ id: "user-1" });
    mockGetCartCount.mockResolvedValue(3);

    const element = await CustomerLayout({ children: <div /> });
    render(element as React.ReactElement);

    expect(mockGetCartCount).toHaveBeenCalledWith("user-1");
    expect(screen.getByLabelText(/cart\.header\.count/)).toHaveTextContent("3");
  });

  it("passes cartCount=0 to CustomerHeader when user is not signed in", async () => {
    mockGetCurrentUserCached.mockResolvedValue(null);

    const element = await CustomerLayout({ children: <div /> });
    render(element as React.ReactElement);

    expect(mockGetCartCount).not.toHaveBeenCalled();
    expect(screen.queryByLabelText(/cart\.header\.count/)).toBeNull();
  });
});
