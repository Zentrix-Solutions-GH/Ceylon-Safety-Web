// S-044: /admin/security page — AC1, AC2, AC5, EC2

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as React from "react";
import SecurityPageClient from "../SecurityPageClient";

// Mock QRCode to avoid canvas rendering in jsdom
vi.mock("qrcode", () => ({
  default: { toCanvas: vi.fn().mockResolvedValue(undefined) },
  toCanvas: vi.fn().mockResolvedValue(undefined),
}));

const mockConfirmMFAEnrolment = vi.fn();
vi.mock("@/lib/admin/actions/mfa-enrolment", () => ({
  confirmMFAEnrolment: (...args: unknown[]) => mockConfirmMFAEnrolment(...args),
}));

const DEFAULT_PROPS = {
  factorId: "factor-id-1",
  uri: "otpauth://totp/CeylonSafety:admin@example.com?secret=JBSWY3DPEHPK3PXP",
  secret: "JBSWY3DPEHPK3PXP",
  next: "/admin/dashboard",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SecurityPageClient — AC1: renders QR and secret", () => {
  it("renders a canvas element for the QR code (EC2: client-side only)", () => {
    render(<SecurityPageClient {...DEFAULT_PROPS} />);
    expect(document.querySelector("canvas")).toBeInTheDocument();
  });

  it("renders the TOTP secret for manual entry", () => {
    render(<SecurityPageClient {...DEFAULT_PROPS} />);
    expect(screen.getByText("JBSWY3DPEHPK3PXP")).toBeInTheDocument();
  });

  it("renders a 6-digit code input", () => {
    render(<SecurityPageClient {...DEFAULT_PROPS} />);
    const input = screen.getByLabelText(/6-digit code/i);
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("maxLength", "6");
  });

  it("AC1: on success redirects to next admin page", async () => {
    mockConfirmMFAEnrolment.mockResolvedValue({ ok: true });
    const hrefSetter = vi.fn();
    const loc = { href: "/admin/security" };
    Object.defineProperty(loc, "href", { set: hrefSetter, get: () => "/admin/security" });
    Object.defineProperty(window, "location", { value: loc, writable: true });

    render(<SecurityPageClient {...DEFAULT_PROPS} next="/admin/articles" />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/6-digit code/i), "123456");
    await user.click(screen.getByRole("button", { name: /confirm/i }));

    await waitFor(() => {
      expect(hrefSetter).toHaveBeenCalledWith("/admin/articles");
    });
  });

  it("AC1: falls back to /admin/dashboard when next is /", async () => {
    mockConfirmMFAEnrolment.mockResolvedValue({ ok: true });
    const hrefSetter = vi.fn();
    const loc = { href: "/admin/security" };
    Object.defineProperty(loc, "href", { set: hrefSetter, get: () => "/admin/security" });
    Object.defineProperty(window, "location", { value: loc, writable: true });

    render(<SecurityPageClient {...DEFAULT_PROPS} next="/" />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/6-digit code/i), "123456");
    await user.click(screen.getByRole("button", { name: /confirm/i }));

    await waitFor(() => {
      expect(hrefSetter).toHaveBeenCalledWith("/admin/dashboard");
    });
  });

  it("shows error message on code_invalid", async () => {
    mockConfirmMFAEnrolment.mockResolvedValue({ ok: false, code: "code_invalid" });

    render(<SecurityPageClient {...DEFAULT_PROPS} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/6-digit code/i), "000000");
    await user.click(screen.getByRole("button", { name: /confirm/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });
});

describe("SecurityPageClient — AC5: no third-party scripts", () => {
  it("renders no <script> tags", () => {
    const { container } = render(<SecurityPageClient {...DEFAULT_PROPS} />);
    expect(container.querySelectorAll("script")).toHaveLength(0);
  });

  it("renders no <img> tags (QR is canvas-based, not an external image)", () => {
    const { container } = render(<SecurityPageClient {...DEFAULT_PROPS} />);
    expect(container.querySelectorAll("img")).toHaveLength(0);
  });
});
