// S-091: HeaderPersonal — AC8 cart count badge
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

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

import { HeaderPersonal } from "@/components/layout/HeaderPersonal";

describe("HeaderPersonal — AC8: cart count badge", () => {
  it("shows badge with count when cartCount > 0", () => {
    render(<HeaderPersonal cartCount={3} />);
    const badge = screen.getByLabelText(/cart\.header\.count/);
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent("3");
  });

  it("shows '99+' when cartCount > 99", () => {
    render(<HeaderPersonal cartCount={100} />);
    const badge = screen.getByLabelText(/cart\.header\.count/);
    expect(badge).toHaveTextContent("99+");
  });

  it("hides badge when cartCount is 0", () => {
    render(<HeaderPersonal cartCount={0} />);
    expect(screen.queryByLabelText(/cart\.header\.count/)).toBeNull();
  });

  it("hides badge when cartCount is undefined", () => {
    render(<HeaderPersonal />);
    expect(screen.queryByLabelText(/cart\.header\.count/)).toBeNull();
  });

  it("shows singular aria-label when cartCount is 1", () => {
    render(<HeaderPersonal cartCount={1} />);
    expect(screen.getByLabelText("cart.header.count_one")).toBeInTheDocument();
  });
});
