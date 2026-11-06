import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

const mockResetPassword = vi.fn();
vi.mock("@/lib/auth/actions/reset-password", () => ({
  resetPassword: (...args: unknown[]) => mockResetPassword(...args),
}));

const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => ({ get: () => null }),
}));

describe("ResetPasswordForm — AC7: renders OTP + new-password fields", () => {
  beforeEach(() => {
    mockResetPassword.mockReset();
    mockReplace.mockReset();
  });

  it("renders email, code, new-password fields when email prop provided", () => {
    render(<ResetPasswordForm email="user@example.com" />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/reset code/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
  });

  it("email field is pre-filled and readonly when initialEmail prop is provided", () => {
    render(<ResetPasswordForm email="user@example.com" />);
    const emailInput = screen.getByLabelText(/email/i);
    expect(emailInput).toHaveValue("user@example.com");
    expect(emailInput).toHaveAttribute("readonly");
  });

  it("renders email field for manual entry when no email prop (EC1)", () => {
    render(<ResetPasswordForm />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByText(/enter your code below/i)).toBeInTheDocument();
  });
});

describe("ResetPasswordForm — AC7: TOTP field shown for staff (mfa_required)", () => {
  beforeEach(() => {
    mockResetPassword.mockReset();
    mockReplace.mockReset();
  });

  it("shows TOTP field after mfa_required response", async () => {
    mockResetPassword
      .mockResolvedValueOnce({ ok: false, code: "mfa_required" })
      .mockResolvedValueOnce({ ok: true, redirectTo: "/" });
    render(<ResetPasswordForm email="staff@example.com" />);
    await userEvent.type(screen.getByLabelText(/reset code/i), "123456");
    await userEvent.type(screen.getByLabelText(/new password/i), "NewPass123!");
    await userEvent.click(screen.getByRole("button", { name: /set new password/i }));
    await waitFor(() => {
      expect(screen.getByLabelText(/authenticator code/i)).toBeInTheDocument();
    });
  });

  it("redirects home after successful reset with TOTP and forwards authenticatorCode", async () => {
    mockResetPassword
      .mockResolvedValueOnce({ ok: false, code: "mfa_required" })
      .mockResolvedValueOnce({ ok: true, redirectTo: "/" });
    render(<ResetPasswordForm email="staff@example.com" />);
    await userEvent.type(screen.getByLabelText(/reset code/i), "123456");
    await userEvent.type(screen.getByLabelText(/new password/i), "NewPass123!");
    await userEvent.click(screen.getByRole("button", { name: /set new password/i }));
    await waitFor(() => screen.getByLabelText(/authenticator code/i));
    await userEvent.type(screen.getByLabelText(/authenticator code/i), "654321");
    await userEvent.click(screen.getByRole("button", { name: /set new password/i }));
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/");
      expect(mockResetPassword).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ authenticatorCode: "654321" })
      );
    });
  });
});

describe("ResetPasswordForm — AC7: happy path redirects home", () => {
  beforeEach(() => {
    mockResetPassword.mockReset();
    mockReplace.mockReset();
  });

  it("redirects on successful reset", async () => {
    mockResetPassword.mockResolvedValue({ ok: true, redirectTo: "/" });
    render(<ResetPasswordForm email="user@example.com" />);
    await userEvent.type(screen.getByLabelText(/reset code/i), "123456");
    await userEvent.type(screen.getByLabelText(/new password/i), "NewPass123!");
    await userEvent.click(screen.getByRole("button", { name: /set new password/i }));
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/");
    });
  });
});

describe("ResetPasswordForm — AC8: error codes map via messages/en.ts", () => {
  beforeEach(() => {
    mockResetPassword.mockReset();
  });

  it("shows mapped message for code_expired", async () => {
    mockResetPassword.mockResolvedValue({ ok: false, code: "code_expired" });
    render(<ResetPasswordForm email="user@example.com" />);
    await userEvent.type(screen.getByLabelText(/reset code/i), "000000");
    await userEvent.type(screen.getByLabelText(/new password/i), "NewPass123!");
    await userEvent.click(screen.getByRole("button", { name: /set new password/i }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/code has expired/i);
    });
  });

  it("shows mapped message for code_invalid", async () => {
    mockResetPassword.mockResolvedValue({ ok: false, code: "code_invalid" });
    render(<ResetPasswordForm email="user@example.com" />);
    await userEvent.type(screen.getByLabelText(/reset code/i), "000000");
    await userEvent.type(screen.getByLabelText(/new password/i), "NewPass123!");
    await userEvent.click(screen.getByRole("button", { name: /set new password/i }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/code is not right/i);
    });
  });

  it("shows mapped message for weak_password", async () => {
    mockResetPassword.mockResolvedValue({ ok: false, code: "weak_password" });
    render(<ResetPasswordForm email="user@example.com" />);
    await userEvent.type(screen.getByLabelText(/reset code/i), "123456");
    await userEvent.type(screen.getByLabelText(/new password/i), "123");
    await userEvent.click(screen.getByRole("button", { name: /set new password/i }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/stronger password/i);
    });
  });
});

describe("ResetPasswordForm — exception resilience: button re-enables after thrown error", () => {
  beforeEach(() => {
    mockResetPassword.mockReset();
    mockReplace.mockReset();
  });

  it("re-enables button and shows error when resetPassword throws", async () => {
    mockResetPassword.mockRejectedValue(new Error("network"));
    render(<ResetPasswordForm email="user@example.com" />);
    await userEvent.type(screen.getByLabelText(/reset code/i), "123456");
    await userEvent.type(screen.getByLabelText(/new password/i), "NewPass123!");
    await userEvent.click(screen.getByRole("button", { name: /set new password/i }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /set new password/i })).not.toBeDisabled();
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });
});
