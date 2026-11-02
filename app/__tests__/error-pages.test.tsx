import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/"),
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}));

import ErrorPage from "@/app/error";
import NotFoundPage from "@/app/not-found";

const mockReset = vi.fn();

// ─── AC7: root error page ────────────────────────────────────────────────────

describe("ErrorPage", () => {
  it("shows friendly heading — no stack trace or technical text", () => {
    render(<ErrorPage error={new Error("boom")} reset={mockReset} />);
    expect(screen.getByRole("heading")).toBeInTheDocument();
    expect(screen.queryByText(/boom/)).toBeNull();
    expect(screen.queryByText(/stack/i)).toBeNull();
  });

  it("has a Try again button that calls reset", async () => {
    const { getByRole } = render(<ErrorPage error={new Error()} reset={mockReset} />);
    const btn = getByRole("button");
    btn.click();
    expect(mockReset).toHaveBeenCalled();
  });

  it("has a link to Home", () => {
    render(<ErrorPage error={new Error()} reset={mockReset} />);
    const homeLink = screen.getByRole("link", { name: /home/i });
    expect(homeLink).toHaveAttribute("href", "/");
  });
});

// ─── AC8: not-found page ─────────────────────────────────────────────────────

describe("NotFoundPage", () => {
  it("shows a heading", () => {
    render(<NotFoundPage />);
    expect(screen.getByRole("heading")).toBeInTheDocument();
  });

  it("has a link to Home", () => {
    render(<NotFoundPage />);
    const links = screen.getAllByRole("link");
    const hrefs = links.map((l) => l.getAttribute("href"));
    expect(hrefs).toContain("/");
  });

  it("has a link to Articles", () => {
    render(<NotFoundPage />);
    expect(screen.getByRole("link", { name: /articles/i })).toBeInTheDocument();
  });

  it("has a link to Courses", () => {
    render(<NotFoundPage />);
    expect(screen.getByRole("link", { name: /courses/i })).toBeInTheDocument();
  });

  it("has a link to Contact Coach", () => {
    render(<NotFoundPage />);
    expect(screen.getByRole("link", { name: /contact/i })).toBeInTheDocument();
  });
});
