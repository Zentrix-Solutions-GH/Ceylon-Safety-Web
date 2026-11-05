import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as React from "react";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

const mockRequestPasswordReset = vi.fn();
vi.mock("@/lib/auth/actions/request-password-reset", () => ({
  requestPasswordReset: (...args: unknown[]) => mockRequestPasswordReset(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => ({ get: () => null }),
}));

vi.mock("@/components/auth/TurnstileWidget", () => ({
  TurnstileWidget: ({ onToken }: { onToken: (t: string) => void }) => {
    React.useEffect(() => { onToken("test-token"); }, [onToken]);
    return <div data-testid="turnstile" />;
  },
}));

describe("ForgotPasswordForm — AC6: renders email input and Turnstile", () => {
  beforeEach(() => {
    mockRequestPasswordReset.mockReset();
  });

  it("renders email field and Turnstile widget", () => {
    render(<ForgotPasswordForm />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByTestId("turnstile")).toBeInTheDocument();
  });

  it("renders submit button", () => {
    render(<ForgotPasswordForm />);
    expect(screen.getByRole("button", { name: /send reset code/i })).toBeInTheDocument();
  });

  it("renders back-to-sign-in link", () => {
    render(<ForgotPasswordForm />);
    expect(screen.getByRole("link", { name: /back to sign in/i })).toHaveAttribute(
      "href",
      "/sign-in"
    );
  });
});

describe("ForgotPasswordForm — AC6: always shows neutral message", () => {
  beforeEach(() => {
    mockRequestPasswordReset.mockReset();
  });

  it("shows neutral success message on ok:true", async () => {
    mockRequestPasswordReset.mockResolvedValue({ ok: true });
    render(<ForgotPasswordForm />);
    await userEvent.type(screen.getByLabelText(/email/i), "user@example.com");
    await userEvent.click(screen.getByRole("button", { name: /send reset code/i }));
    await waitFor(() => {
      expect(screen.getByText(/if an account exists/i)).toBeInTheDocument();
    });
  });

  it("still shows neutral message on ok:false (never leaks error)", async () => {
    mockRequestPasswordReset.mockResolvedValue({ ok: false, code: "rate_limited" });
    render(<ForgotPasswordForm />);
    await userEvent.type(screen.getByLabelText(/email/i), "user@example.com");
    await userEvent.click(screen.getByRole("button", { name: /send reset code/i }));
    await waitFor(() => {
      expect(screen.getByText(/if an account exists/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/too many requests/i)).not.toBeInTheDocument();
  });
});

describe("ForgotPasswordForm — AC6: calls requestPasswordReset with correct args", () => {
  beforeEach(() => {
    mockRequestPasswordReset.mockReset();
  });

  it("passes email and captchaToken to requestPasswordReset", async () => {
    mockRequestPasswordReset.mockResolvedValue({ ok: true });
    render(<ForgotPasswordForm />);
    await userEvent.type(screen.getByLabelText(/email/i), "test@example.com");
    await userEvent.click(screen.getByRole("button", { name: /send reset code/i }));
    await waitFor(() => {
      expect(mockRequestPasswordReset).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "test@example.com",
          captchaToken: "test-token",
        })
      );
    });
  });
});
