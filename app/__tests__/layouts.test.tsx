import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

// Mock next/navigation (needed by HeaderPersonal / CustomerHeader)
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/"),
  useRouter: vi.fn(() => ({ push: vi.fn() })),
  useParams: vi.fn(() => ({})),
}));

// Mock useAuth (browser-only hook)
vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(() => ({ user: null, isLoading: false, signOut: vi.fn() })),
}));

// jsdom stubs for Radix Sheet used by HeaderPersonal
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

import AuthLayout from "@/app/(auth)/layout";
import CustomerLayout from "@/app/(customer)/layout";
import AdminLayout from "@/app/admin/layout";

// ─── AC3: auth layout ─────────────────────────────────────────────────────────

describe("AuthLayout", () => {
  it("renders children", () => {
    render(<AuthLayout><div data-testid="child" /></AuthLayout>);
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("has no main site header (nav role)", () => {
    render(<AuthLayout><div /></AuthLayout>);
    // The public Header renders a <header> with role=banner and a nav inside.
    // Auth layout must not render the main site nav.
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("has no footer (contentinfo role)", () => {
    render(<AuthLayout><div /></AuthLayout>);
    expect(screen.queryByRole("contentinfo")).toBeNull();
  });

  it("exports noindex metadata", async () => {
    const mod = await import("@/app/(auth)/layout");
    expect((mod as { metadata?: { robots?: { index?: boolean } } }).metadata?.robots?.index).toBe(false);
  });
});

// ─── AC4: customer layout ────────────────────────────────────────────────────

describe("CustomerLayout", () => {
  it("renders children", () => {
    render(<CustomerLayout><div data-testid="child" /></CustomerLayout>);
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("has no public Footer (contentinfo)", () => {
    render(<CustomerLayout><div /></CustomerLayout>);
    expect(screen.queryByRole("contentinfo")).toBeNull();
  });

  it("exports noindex metadata", async () => {
    const mod = await import("@/app/(customer)/layout");
    expect((mod as { metadata?: { robots?: { index?: boolean } } }).metadata?.robots?.index).toBe(false);
  });
});

// ─── AC5: admin layout ───────────────────────────────────────────────────────

describe("AdminLayout", () => {
  it("renders children", () => {
    render(<AdminLayout><div data-testid="child" /></AdminLayout>);
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("has no public Header or Footer", () => {
    render(<AdminLayout><div /></AdminLayout>);
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(screen.queryByRole("contentinfo")).toBeNull();
  });

  it("exports noindex metadata", async () => {
    const mod = await import("@/app/admin/layout");
    expect((mod as { metadata?: { robots?: { index?: boolean } } }).metadata?.robots?.index).toBe(false);
  });
});
