// S-044: /admin/mfa page — AC3, AC4, AC5, EC1

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as React from "react";
import MfaPageClient from "../MfaPageClient";

const mockSubmitMFAChallenge = vi.fn();
vi.mock("@/lib/admin/actions/mfa-challenge", () => ({
  submitMFAChallenge: (...args: unknown[]) => mockSubmitMFAChallenge(...args),
}));

const DEFAULT_PROPS = { next: "/admin/dashboard" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("MfaPageClient — AC3: 6-digit input and submission", () => {
  it("renders a single 6-digit TOTP input", () => {
    render(<MfaPageClient {...DEFAULT_PROPS} />);
    const input = screen.getByLabelText(/6-digit code/i);
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("maxLength", "6");
  });

  it("AC3: correct code redirects to intended admin page", async () => {
    mockSubmitMFAChallenge.mockResolvedValue({ ok: true });
    const hrefSetter = vi.fn();
    const loc = { href: "/admin/mfa" };
    Object.defineProperty(loc, "href", { set: hrefSetter, get: () => "/admin/mfa" });
    Object.defineProperty(window, "location", { value: loc, writable: true });

    render(<MfaPageClient next="/admin/articles" />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/6-digit code/i), "123456");
    await user.click(screen.getByRole("button", { name: /verify/i }));

    await waitFor(() => {
      expect(hrefSetter).toHaveBeenCalledWith("/admin/articles");
    });
  });

  it("AC3: falls back to /admin/dashboard when next is /", async () => {
    mockSubmitMFAChallenge.mockResolvedValue({ ok: true });
    const hrefSetter = vi.fn();
    const loc = { href: "/admin/mfa" };
    Object.defineProperty(loc, "href", { set: hrefSetter, get: () => "/admin/mfa" });
    Object.defineProperty(window, "location", { value: loc, writable: true });

    render(<MfaPageClient next="/" />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/6-digit code/i), "123456");
    await user.click(screen.getByRole("button", { name: /verify/i }));

    await waitFor(() => {
      expect(hrefSetter).toHaveBeenCalledWith("/admin/dashboard");
    });
  });

  it("AC3: wrong code → shows code_invalid error", async () => {
    mockSubmitMFAChallenge.mockResolvedValue({ ok: false, code: "code_invalid" });

    render(<MfaPageClient {...DEFAULT_PROPS} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/6-digit code/i), "000000");
    await user.click(screen.getByRole("button", { name: /verify/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });

  it("AC3: too many attempts → shows code_attempts_exceeded error", async () => {
    mockSubmitMFAChallenge.mockResolvedValue({ ok: false, code: "code_attempts_exceeded" });

    render(<MfaPageClient {...DEFAULT_PROPS} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/6-digit code/i), "123456");
    await user.click(screen.getByRole("button", { name: /verify/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });
});

describe("MfaPageClient — AC5: no third-party scripts", () => {
  it("renders no <script> tags", () => {
    const { container } = render(<MfaPageClient {...DEFAULT_PROPS} />);
    expect(container.querySelectorAll("script")).toHaveLength(0);
  });
});
