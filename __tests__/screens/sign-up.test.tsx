import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as React from "react";
import { SignUpForm } from "@/components/auth/SignUpForm";

// Mock server action
const mockSignUp = vi.fn();
vi.mock("@/lib/auth/actions/sign-up", () => ({
  signUp: (...args: unknown[]) => mockSignUp(...args),
}));

// Mock Next.js router
const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => ({ get: () => null }),
}));

// Mock Turnstile widget — in tests, immediately calls onToken with a fake token
vi.mock("@/components/auth/TurnstileWidget", () => ({
  TurnstileWidget: ({ onToken }: { onToken: (t: string) => void }) => {
    React.useEffect(() => { onToken("test-token"); }, [onToken]);
    return <div data-testid="turnstile" />;
  },
}));

describe("SignUpForm — AC1: renders all required fields", () => {
  beforeEach(() => {
    mockSignUp.mockReset();
    mockReplace.mockReset();
  });

  it("renders first name, last name, email, password fields", () => {
    render(<SignUpForm />);
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it("renders terms and privacy links", () => {
    render(<SignUpForm />);
    expect(screen.getByRole("link", { name: /terms/i })).toHaveAttribute("href", "/terms");
    expect(screen.getByRole("link", { name: /privacy/i })).toHaveAttribute("href", "/privacy");
  });

  it("renders terms checkbox", () => {
    render(<SignUpForm />);
    expect(screen.getByRole("checkbox", { name: /agree/i })).toBeInTheDocument();
  });

  it("renders Turnstile widget", () => {
    render(<SignUpForm />);
    expect(screen.getByTestId("turnstile")).toBeInTheDocument();
  });

  it("AC1: submitting valid data calls signUp and redirects to /verify-email", async () => {
    mockSignUp.mockResolvedValue({ ok: true, redirect: "/verify-email" });
    const user = userEvent.setup();
    render(<SignUpForm />);

    await user.type(screen.getByLabelText(/first name/i), "Aysha");
    await user.type(screen.getByLabelText(/last name/i), "Perera");
    await user.type(screen.getByLabelText(/email/i), "aysha@example.com");
    await user.type(screen.getByLabelText(/password/i), "StrongPass123!");
    await user.click(screen.getByRole("checkbox", { name: /agree/i }));
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: "Aysha",
          lastName: "Perera",
          email: "aysha@example.com",
          password: "StrongPass123!",
          termsAccepted: true,
          captchaToken: "test-token",
        })
      );
    });
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/verify-email"));
  });
});

describe("SignUpForm — AC2: error codes", () => {
  beforeEach(() => {
    mockSignUp.mockReset();
    mockReplace.mockReset();
  });

  it("weak_password error renders next to password field", async () => {
    mockSignUp.mockResolvedValue({ ok: false, code: "weak_password", field: "password" });
    const user = userEvent.setup();
    render(<SignUpForm />);

    await user.type(screen.getByLabelText(/first name/i), "A");
    await user.type(screen.getByLabelText(/last name/i), "B");
    await user.type(screen.getByLabelText(/email/i), "a@b.com");
    await user.type(screen.getByLabelText(/password/i), "short");
    await user.click(screen.getByRole("checkbox", { name: /agree/i }));
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() =>
      expect(screen.getByText(/stronger password/i)).toBeInTheDocument()
    );
  });

  it("already_registered shows neutral message (not revealing email existence)", async () => {
    // signUp always returns ok:true for existing emails (server action is neutral)
    // This test verifies the form redirects to /verify-email regardless
    mockSignUp.mockResolvedValue({ ok: true, redirect: "/verify-email" });
    const user = userEvent.setup();
    render(<SignUpForm />);

    await user.type(screen.getByLabelText(/first name/i), "A");
    await user.type(screen.getByLabelText(/last name/i), "B");
    await user.type(screen.getByLabelText(/email/i), "existing@example.com");
    await user.type(screen.getByLabelText(/password/i), "StrongPass123!");
    await user.click(screen.getByRole("checkbox", { name: /agree/i }));
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/verify-email"));
    expect(screen.queryByText(/already registered/i)).not.toBeInTheDocument();
  });

  it("EC5: validation_failed with field renders error adjacent to that field", async () => {
    mockSignUp.mockResolvedValue({ ok: false, code: "validation_failed", field: "email" });
    const user = userEvent.setup();
    render(<SignUpForm />);

    await user.type(screen.getByLabelText(/first name/i), "A");
    await user.type(screen.getByLabelText(/last name/i), "B");
    await user.type(screen.getByLabelText(/email/i), "not-an-email");
    await user.type(screen.getByLabelText(/password/i), "StrongPass123!");
    await user.click(screen.getByRole("checkbox", { name: /agree/i }));
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      const emailField = screen.getByLabelText(/email/i);
      expect(emailField).toHaveAttribute("aria-invalid", "true");
    });
  });

  it("EC1: captcha_failed shows mapped message", async () => {
    mockSignUp.mockResolvedValue({ ok: false, code: "captcha_failed" });
    const user = userEvent.setup();
    render(<SignUpForm />);

    await user.type(screen.getByLabelText(/first name/i), "A");
    await user.type(screen.getByLabelText(/last name/i), "B");
    await user.type(screen.getByLabelText(/email/i), "a@b.com");
    await user.type(screen.getByLabelText(/password/i), "StrongPass123!");
    await user.click(screen.getByRole("checkbox", { name: /agree/i }));
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() =>
      expect(screen.getByText(/security check failed/i)).toBeInTheDocument()
    );
  });
});
