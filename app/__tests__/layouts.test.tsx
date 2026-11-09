import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

// next/font/google is not available in Vitest/jsdom — mock font constructors
vi.mock("next/font/google", () => ({
  Inter: () => ({ variable: "--font-sans", className: "" }),
  Noto_Sans_Sinhala: () => ({ variable: "--font-sinhala", className: "" }),
  Noto_Sans_Tamil: () => ({ variable: "--font-tamil", className: "" }),
}));

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

// next/font/google is not available in jsdom — stub each font to return a plain object
vi.mock("next/font/google", () => ({
  Inter: () => ({ variable: "--font-sans", className: "" }),
  Noto_Sans_Sinhala: () => ({ variable: "--font-sinhala", className: "" }),
  Noto_Sans_Tamil: () => ({ variable: "--font-tamil", className: "" }),
}));

// S-045: AdminLayout is an async RSC — render AdminShell (its client wrapper) for
// layout structure tests. Server-side data-fetching is tested in __tests__/admin/.
vi.mock("@/app/admin/layout", async () => {
  const { default: AdminShell } = await import("@/app/admin/AdminShell");
  const React = await import("react");
  return {
    __esModule: true,
    metadata: { robots: { index: false, follow: false } },
    default: ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        AdminShell,
        { displayName: "Admin User", email: "admin@example.com", role: "admin" as const },
        children
      ),
  };
});
vi.mock("@/lib/auth/actions", () => ({
  signOut: vi.fn(),
}));

// Mocks for RootLayout and PublicLayout
vi.mock("@/components/ui/toaster", () => ({ Toaster: () => null }));
vi.mock("@/components/layout/CookieConsentBanner", () => ({ default: () => null }));
vi.mock("@/components/layout/Header", () => ({
  default: () => <header role="banner" />,
}));
vi.mock("@/components/layout/Footer", () => ({
  default: () => <footer />,
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
import RootLayout from "@/app/layout";
import PublicLayout from "@/app/(public)/layout";

// ─── AC1: root layout ────────────────────────────────────────────────────────

describe("RootLayout", () => {
  it("has a skip link with href #main-content", () => {
    render(<RootLayout><div /></RootLayout>);
    const skipLink = screen.getByRole("link", { name: /skip to main/i });
    expect(skipLink).toHaveAttribute("href", "#main-content");
  });

  it("skip link is the first link in the page", () => {
    render(<RootLayout><div /></RootLayout>);
    const allLinks = screen.getAllByRole("link");
    expect(allLinks[0]).toHaveAttribute("href", "#main-content");
  });

  it("renders children", () => {
    render(<RootLayout><div data-testid="child" /></RootLayout>);
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });
});

// ─── AC2: public layout ───────────────────────────────────────────────────────

describe("PublicLayout", () => {
  it("renders main#main-content (skip-link target)", () => {
    render(<PublicLayout modal={null}><div /></PublicLayout>);
    expect(document.getElementById("main-content")).toBeInTheDocument();
  });

  it("renders children inside main#main-content", () => {
    render(<PublicLayout modal={null}><div data-testid="child" /></PublicLayout>);
    const main = document.getElementById("main-content")!;
    expect(main).toContainElement(screen.getByTestId("child"));
  });

  it("has a header (banner role)", () => {
    render(<PublicLayout modal={null}><div /></PublicLayout>);
    expect(screen.getByRole("banner")).toBeInTheDocument();
  });

  it("has a footer (contentinfo role)", () => {
    render(<PublicLayout modal={null}><div /></PublicLayout>);
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });
});

// ─── AC3: auth layout ─────────────────────────────────────────────────────────

describe("AuthLayout", () => {
  it("renders children inside main#main-content (skip-link target)", () => {
    render(<AuthLayout><div data-testid="child" /></AuthLayout>);
    const main = document.getElementById("main-content")!;
    expect(main).toBeInTheDocument();
    expect(main).toContainElement(screen.getByTestId("child"));
  });

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
  it("renders main#main-content (skip-link target)", () => {
    render(<CustomerLayout><div /></CustomerLayout>);
    expect(document.getElementById("main-content")).toBeInTheDocument();
  });

  it("renders children inside main#main-content", () => {
    render(<CustomerLayout><div data-testid="child" /></CustomerLayout>);
    const main = document.getElementById("main-content")!;
    expect(main).toContainElement(screen.getByTestId("child"));
  });

  it("renders CustomerHeader (AC4)", () => {
    render(<CustomerLayout><div /></CustomerLayout>);
    expect(screen.getByRole("banner")).toBeInTheDocument();
  });

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
  it("renders main#main-content (skip-link target)", () => {
    render(<AdminLayout><div /></AdminLayout>);
    expect(document.getElementById("main-content")).toBeInTheDocument();
  });

  it("renders children inside main#main-content", () => {
    render(<AdminLayout><div data-testid="child" /></AdminLayout>);
    const main = document.getElementById("main-content")!;
    expect(main).toContainElement(screen.getByTestId("child"));
  });

  it("renders children", () => {
    render(<AdminLayout><div data-testid="child" /></AdminLayout>);
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("has no public Footer (contentinfo)", () => {
    render(<AdminLayout><div /></AdminLayout>);
    expect(screen.queryByRole("contentinfo")).toBeNull();
  });

  it("has an admin navigation sidebar", () => {
    render(<AdminLayout><div /></AdminLayout>);
    expect(screen.getByRole("navigation", { name: /admin navigation/i })).toBeInTheDocument();
  });

  it("exports noindex metadata", async () => {
    const mod = await import("@/app/admin/layout");
    expect((mod as { metadata?: { robots?: { index?: boolean } } }).metadata?.robots?.index).toBe(false);
  });
});
