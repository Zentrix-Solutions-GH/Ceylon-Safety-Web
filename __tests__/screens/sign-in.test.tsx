import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as React from "react";
import { SignInForm } from "@/components/auth/SignInForm";

const mockSignIn = vi.fn();
vi.mock("@/lib/auth/actions/sign-in", () => ({
  signIn: (...args: unknown[]) => mockSignIn(...args),
}));

const mockStartGoogleSignIn = vi.fn();
vi.mock("@/lib/auth/actions/start-google-sign-in", () => ({
  startGoogleSignIn: (...args: unknown[]) => mockStartGoogleSignIn(...args),
}));

const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => ({ get: () => null }),
}));

vi.mock("@/components/auth/TurnstileWidget", () => ({
  TurnstileWidget: ({ onToken }: { onToken: (t: string) => void }) => {
    React.useEffect(() => { onToken("test-token"); }, [onToken]);
    return <div data-testid="turnstile" />;
  },
}));

const mockNavigator = { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)" };

describe("SignInForm — AC1: renders required fields and controls", () => {
  beforeEach(() => {
    mockSignIn.mockReset();
    mockReplace.mockReset();
    mockStartGoogleSignIn.mockReset();
    Object.defineProperty(window, "navigator", { value: mockNavigator, writable: true });
  });

  it("renders email, password fields and Turnstile", () => {
    render(<SignInForm />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByTestId("turnstile")).toBeInTheDocument();
  });

  it("renders forgot-password link pointing to /forgot-password", () => {
    render(<SignInForm />);
    expect(screen.getByRole("link", { name: /forgot password/i })).toHaveAttribute(
      "href",
      "/forgot-password"
    );
  });

  it("renders sign-up link pointing to /sign-up", () => {
    render(<SignInForm />);
    expect(screen.getByRole("link", { name: /create one/i })).toHaveAttribute("href", "/sign-up");
  });

  it("renders Google sign-in button", () => {
    render(<SignInForm />);
    expect(screen.getByRole("button", { name: /continue with google/i })).toBeInTheDocument();
  });
});

describe("SignInForm — AC1/happy path: submits and redirects", () => {
  beforeEach(() => {
    mockSignIn.mockReset();
    mockReplace.mockReset();
    Object.defineProperty(window, "navigator", { value: mockNavigator, writable: true });
  });

  it("calls signIn with email, password and captcha token then redirects", async () => {
    mockSignIn.mockResolvedValue({ ok: true, redirectTo: "/dashboard" });
    render(<SignInForm />);
    await userEvent.type(screen.getByLabelText(/email/i), "user@example.com");
    await userEvent.type(screen.getByLabelText(/password/i), "secret123");
    await userEvent.click(screen.getByRole("button", { name: /^sign in$/i }));
    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "user@example.com",
          password: "secret123",
          captchaToken: "test-token",
        })
      );
      expect(mockReplace).toHaveBeenCalledWith("/dashboard");
    });
  });
});

describe("SignInForm — AC2: invalid_credentials shows mapped message", () => {
  beforeEach(() => {
    mockSignIn.mockReset();
    Object.defineProperty(window, "navigator", { value: mockNavigator, writable: true });
  });

  it("shows 'Email or password is not correct' on invalid_credentials", async () => {
    mockSignIn.mockResolvedValue({ ok: false, code: "invalid_credentials" });
    render(<SignInForm />);
    await userEvent.type(screen.getByLabelText(/email/i), "user@example.com");
    await userEvent.type(screen.getByLabelText(/password/i), "wrongpass");
    await userEvent.click(screen.getByRole("button", { name: /^sign in$/i }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/email or password is not correct/i);
    });
  });
});

describe("SignInForm — AC3: email_not_verified redirects to /verify-email", () => {
  beforeEach(() => {
    mockSignIn.mockReset();
    mockReplace.mockReset();
    Object.defineProperty(window, "navigator", { value: mockNavigator, writable: true });
  });

  it("redirects to /verify-email on email_not_verified", async () => {
    mockSignIn.mockResolvedValue({ ok: false, code: "email_not_verified" });
    render(<SignInForm />);
    await userEvent.type(screen.getByLabelText(/email/i), "user@example.com");
    await userEvent.type(screen.getByLabelText(/password/i), "correct123");
    await userEvent.click(screen.getByRole("button", { name: /^sign in$/i }));
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/verify-email");
    });
  });
});

describe("SignInForm — AC4: account_suspended shows suspension message", () => {
  beforeEach(() => {
    mockSignIn.mockReset();
    Object.defineProperty(window, "navigator", { value: mockNavigator, writable: true });
  });

  it("shows suspension message on account_suspended", async () => {
    mockSignIn.mockResolvedValue({ ok: false, code: "account_suspended" });
    render(<SignInForm />);
    await userEvent.type(screen.getByLabelText(/email/i), "banned@example.com");
    await userEvent.type(screen.getByLabelText(/password/i), "mypass123");
    await userEvent.click(screen.getByRole("button", { name: /^sign in$/i }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/suspended/i);
    });
  });
});

describe("SignInForm — AC5: social-app browser shows hint before Google action", () => {
  it("shows social-app hint and copy-link button for Facebook embedded browser", () => {
    Object.defineProperty(window, "navigator", {
      value: { userAgent: "Mozilla/5.0 FBAN/FBForIPhone" },
      writable: true,
    });
    render(<SignInForm />);
    expect(screen.getByText(/open this page in your phone.s normal browser/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy link/i })).toBeInTheDocument();
  });

  it("shows social-app hint for Instagram browser", () => {
    Object.defineProperty(window, "navigator", {
      value: { userAgent: "Mozilla/5.0 Instagram/123" },
      writable: true,
    });
    render(<SignInForm />);
    expect(screen.getByText(/open this page in your phone.s normal browser/i)).toBeInTheDocument();
  });

  it("shows social-app hint for WhatsApp browser", () => {
    Object.defineProperty(window, "navigator", {
      value: { userAgent: "Mozilla/5.0 WhatsApp/2.23" },
      writable: true,
    });
    render(<SignInForm />);
    expect(screen.getByText(/open this page in your phone.s normal browser/i)).toBeInTheDocument();
  });

  it("Google button is not disabled when social-app hint is showing (EC4: no hard block)", () => {
    Object.defineProperty(window, "navigator", {
      value: { userAgent: "Mozilla/5.0 FBAN/FBForIPhone" },
      writable: true,
    });
    render(<SignInForm />);
    expect(screen.getByRole("button", { name: /continue with google/i })).not.toBeDisabled();
  });
});

describe("SignInForm — EC3: Google auth error shows generic message", () => {
  beforeEach(() => {
    mockStartGoogleSignIn.mockReset();
    Object.defineProperty(window, "navigator", { value: mockNavigator, writable: true });
  });

  it("shows generic error when startGoogleSignIn returns ok:false", async () => {
    mockStartGoogleSignIn.mockResolvedValue({ ok: false, code: "unknown" });
    render(<SignInForm />);
    await userEvent.click(screen.getByRole("button", { name: /continue with google/i }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/something went wrong/i);
    });
  });
});

describe("SignInForm — AC8: captcha_failed and rate_limited map via errorMessage", () => {
  beforeEach(() => {
    mockSignIn.mockReset();
    Object.defineProperty(window, "navigator", { value: mockNavigator, writable: true });
  });

  it("shows mapped message on captcha_failed", async () => {
    mockSignIn.mockResolvedValue({ ok: false, code: "captcha_failed" });
    render(<SignInForm />);
    await userEvent.type(screen.getByLabelText(/email/i), "user@example.com");
    await userEvent.type(screen.getByLabelText(/password/i), "pass123");
    await userEvent.click(screen.getByRole("button", { name: /^sign in$/i }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/security check/i);
    });
  });

  it("shows mapped message on rate_limited", async () => {
    mockSignIn.mockResolvedValue({ ok: false, code: "rate_limited" });
    render(<SignInForm />);
    await userEvent.type(screen.getByLabelText(/email/i), "user@example.com");
    await userEvent.type(screen.getByLabelText(/password/i), "pass123");
    await userEvent.click(screen.getByRole("button", { name: /^sign in$/i }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/too many/i);
    });
  });
});

describe("SignInForm — AC5: social-app UA detection covers all 7 platforms", () => {
  it("shows hint for LinkedIn embedded browser", () => {
    Object.defineProperty(window, "navigator", {
      value: { userAgent: "Mozilla/5.0 LinkedInApp/9.0" },
      writable: true,
    });
    render(<SignInForm />);
    expect(screen.getByText(/open this page in your phone.s normal browser/i)).toBeInTheDocument();
  });

  it("shows hint for WeChat (MicroMessenger) browser", () => {
    Object.defineProperty(window, "navigator", {
      value: { userAgent: "Mozilla/5.0 MicroMessenger/8.0" },
      writable: true,
    });
    render(<SignInForm />);
    expect(screen.getByText(/open this page in your phone.s normal browser/i)).toBeInTheDocument();
  });

  it("shows hint for TikTok (BytedanceWebview) browser", () => {
    Object.defineProperty(window, "navigator", {
      value: { userAgent: "Mozilla/5.0 BytedanceWebview/1.0" },
      writable: true,
    });
    render(<SignInForm />);
    expect(screen.getByText(/open this page in your phone.s normal browser/i)).toBeInTheDocument();
  });

  it("does NOT show hint for a standard mobile browser", () => {
    Object.defineProperty(window, "navigator", {
      value: { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1" },
      writable: true,
    });
    render(<SignInForm />);
    expect(screen.queryByText(/open this page in your phone.s normal browser/i)).not.toBeInTheDocument();
  });
});

describe("SignInForm — exception resilience: button re-enables after thrown error", () => {
  beforeEach(() => {
    mockSignIn.mockReset();
    mockStartGoogleSignIn.mockReset();
    Object.defineProperty(window, "navigator", { value: mockNavigator, writable: true });
  });

  it("clears pending state (button label reverts) when signIn throws", async () => {
    mockSignIn.mockRejectedValue(new Error("network"));
    render(<SignInForm />);
    await userEvent.type(screen.getByLabelText(/email/i), "x@x.com");
    await userEvent.type(screen.getByLabelText(/password/i), "pass");
    await userEvent.click(screen.getByRole("button", { name: /^sign in$/i }));
    // pending=false when finally runs: button label reverts from 'Signing in...' to 'Sign in'
    await waitFor(() => {
      expect(screen.queryByText(/signing in/i)).not.toBeInTheDocument();
    });
  });

  it("shows unknown error message when signIn throws", async () => {
    mockSignIn.mockRejectedValue(new Error("network"));
    render(<SignInForm />);
    await userEvent.type(screen.getByLabelText(/email/i), "x@x.com");
    await userEvent.type(screen.getByLabelText(/password/i), "pass");
    await userEvent.click(screen.getByRole("button", { name: /^sign in$/i }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });
});
