import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as React from "react";
import { VerifyEmailForm } from "@/components/auth/VerifyEmailForm";

const mockVerifyEmail = vi.fn();
const mockResendCode = vi.fn();
vi.mock("@/lib/auth/actions/verify-email", () => ({
  verifyEmail: (...args: unknown[]) => mockVerifyEmail(...args),
}));
vi.mock("@/lib/auth/actions/resend-code", () => ({
  resendCode: (...args: unknown[]) => mockResendCode(...args),
}));

const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

vi.mock("@/components/auth/TurnstileWidget", () => ({
  TurnstileWidget: ({ onToken }: { onToken: (t: string) => void }) => {
    React.useEffect(() => { onToken("test-token"); }, [onToken]);
    return <div data-testid="turnstile" />;
  },
}));

describe("VerifyEmailForm — AC3: renders email and code input", () => {
  beforeEach(() => {
    mockVerifyEmail.mockReset();
    mockResendCode.mockReset();
    mockReplace.mockReset();
  });

  it("shows the email address the code was sent to", () => {
    render(<VerifyEmailForm pendingEmail="test@example.com" />);
    expect(screen.getByText(/test@example\.com/)).toBeInTheDocument();
  });

  it("renders code input with autocomplete one-time-code", () => {
    render(<VerifyEmailForm pendingEmail="test@example.com" />);
    const codeInput = screen.getByLabelText(/code/i);
    expect(codeInput).toHaveAttribute("autocomplete", "one-time-code");
    expect(codeInput).toHaveAttribute("inputmode", "numeric");
  });

  it("renders Resend code button", () => {
    render(<VerifyEmailForm pendingEmail="test@example.com" />);
    expect(screen.getByRole("button", { name: /resend/i })).toBeInTheDocument();
  });

  it("renders link back to sign-up", () => {
    render(<VerifyEmailForm pendingEmail="test@example.com" />);
    expect(screen.getByRole("link", { name: /different email/i })).toHaveAttribute("href", "/sign-up");
  });

  it("AC3: correct code submission calls verifyEmail and redirects", async () => {
    mockVerifyEmail.mockResolvedValue({ ok: true, redirect: "/dashboard" });
    const user = userEvent.setup();
    render(<VerifyEmailForm pendingEmail="test@example.com" />);

    await user.type(screen.getByLabelText(/code/i), "123456");
    await user.click(screen.getByRole("button", { name: /verify email/i }));

    await waitFor(() =>
      expect(mockVerifyEmail).toHaveBeenCalledWith({ email: "test@example.com", code: "123456" })
    );
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/dashboard"));
  });

  it("AC3: Resend button is disabled immediately after a successful resend", async () => {
    mockResendCode.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<VerifyEmailForm pendingEmail="test@example.com" />);

    const resendBtn = screen.getByRole("button", { name: /resend code/i });
    await user.click(resendBtn);
    await waitFor(() => expect(resendBtn).toBeDisabled());
  });

  it("AC3: countdown text with seconds is shown after resend", async () => {
    mockResendCode.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<VerifyEmailForm pendingEmail="test@example.com" />);

    await user.click(screen.getByRole("button", { name: /resend code/i }));
    // After resend, the button text should show the cooldown countdown
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /\d+/ })).toBeDisabled()
    );
  });
});

describe("VerifyEmailForm — AC4: error codes", () => {
  beforeEach(() => {
    mockVerifyEmail.mockReset();
    mockResendCode.mockReset();
    mockReplace.mockReset();
  });

  it("code_invalid shows mapped message", async () => {
    mockVerifyEmail.mockResolvedValue({ ok: false, code: "code_invalid" });
    const user = userEvent.setup();
    render(<VerifyEmailForm pendingEmail="test@example.com" />);

    await user.type(screen.getByLabelText(/code/i), "000000");
    await user.click(screen.getByRole("button", { name: /verify/i }));

    await waitFor(() =>
      expect(screen.getByText(/that code is not right/i)).toBeInTheDocument()
    );
  });

  it("code_expired shows mapped message", async () => {
    mockVerifyEmail.mockResolvedValue({ ok: false, code: "code_expired" });
    const user = userEvent.setup();
    render(<VerifyEmailForm pendingEmail="test@example.com" />);

    await user.type(screen.getByLabelText(/code/i), "000000");
    await user.click(screen.getByRole("button", { name: /verify/i }));

    await waitFor(() =>
      expect(screen.getByText(/has expired/i)).toBeInTheDocument()
    );
  });

  it("code_attempts_exceeded shows mapped message", async () => {
    mockVerifyEmail.mockResolvedValue({ ok: false, code: "code_attempts_exceeded" });
    const user = userEvent.setup();
    render(<VerifyEmailForm pendingEmail="test@example.com" />);

    await user.type(screen.getByLabelText(/code/i), "000000");
    await user.click(screen.getByRole("button", { name: /verify/i }));

    await waitFor(() =>
      expect(screen.getByText(/too many wrong attempts/i)).toBeInTheDocument()
    );
  });

  it("EC4: rate_limited on resend shows retryAfterSeconds info", async () => {
    mockResendCode.mockResolvedValue({ ok: false, code: "rate_limited", retryAfterSeconds: 45, reason: "cooldown" });
    const user = userEvent.setup();
    render(<VerifyEmailForm pendingEmail="test@example.com" />);

    await user.click(screen.getByRole("button", { name: /resend/i }));

    await waitFor(() =>
      expect(screen.getByText(/45/)).toBeInTheDocument()
    );
  });
});

describe("VerifyEmailForm — AC5: no pending cookie shows email-entry pre-step", () => {
  it("EC3: renders without crashing when no pendingEmail", () => {
    render(<VerifyEmailForm pendingEmail={null} />);
    expect(screen.getByRole("heading", { name: /enter.*email/i })).toBeInTheDocument();
  });

  it("renders email input in pre-step", () => {
    render(<VerifyEmailForm pendingEmail={null} />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });

  it("renders Send code button in pre-step", () => {
    render(<VerifyEmailForm pendingEmail={null} />);
    expect(screen.getByRole("button", { name: /send code/i })).toBeInTheDocument();
  });
});

describe("VerifyEmailForm — EC2: paste OTP", () => {
  it("single code input accepts paste", async () => {
    const user = userEvent.setup();
    render(<VerifyEmailForm pendingEmail="test@example.com" />);
    const codeInput = screen.getByLabelText(/code/i);
    await user.click(codeInput);
    await user.paste("123456");
    expect(codeInput).toHaveValue("123456");
  });
});
