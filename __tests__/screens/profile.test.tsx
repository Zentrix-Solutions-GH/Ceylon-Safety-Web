import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as React from "react";
import { ProfileForm } from "@/components/profile/ProfileForm";
import type { ProfileFormProps } from "@/components/profile/ProfileForm";

// ─── Mock server actions ───────────────────────────────────────────────────────

const mockUpdateProfile = vi.fn();
vi.mock("@/lib/auth/actions/update-profile", () => ({
  updateProfile: (...args: unknown[]) => mockUpdateProfile(...args),
}));

const mockChangePassword = vi.fn();
vi.mock("@/lib/auth/actions/change-password", () => ({
  changePassword: (...args: unknown[]) => mockChangePassword(...args),
}));

const mockDeleteAccount = vi.fn();
vi.mock("@/lib/auth/actions/delete-account", () => ({
  deleteAccount: (...args: unknown[]) => mockDeleteAccount(...args),
}));

const mockRequestReverification = vi.fn();
vi.mock("@/lib/auth/actions/request-reverification", () => ({
  requestReverification: (...args: unknown[]) => mockRequestReverification(...args),
}));

// ─── Mock Supabase browser client (reauthenticate) ────────────────────────────

const mockReauthenticate = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({
    auth: { reauthenticate: mockReauthenticate },
  }),
}));

// ─── Mock Next.js router ──────────────────────────────────────────────────────

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// ─── Mock Turnstile widget ────────────────────────────────────────────────────

vi.mock("@/components/auth/TurnstileWidget", () => ({
  TurnstileWidget: ({ onToken }: { onToken: (t: string) => void }) => {
    React.useEffect(() => { onToken("test-captcha-token"); }, [onToken]);
    return <div data-testid="turnstile" />;
  },
}));

// ─── Default props ────────────────────────────────────────────────────────────

const defaultProfile = {
  firstName: "Aysha",
  lastName: "Perera",
  displayName: "Aysha P",
  phone: "+94771234567",
  companyName: "Acme Ltd",
  billingAddress: null,
};

const defaultProps: ProfileFormProps = {
  profile: defaultProfile,
  isGoogleOnly: false,
  isStaff: false,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderProfile(props: Partial<ProfileFormProps> = {}) {
  return render(<ProfileForm {...defaultProps} {...props} />);
}

// ─── AC1: renders all four sections ──────────────────────────────────────────

describe("AC1: renders all four sections", () => {
  beforeEach(() => {
    mockUpdateProfile.mockReset();
    mockChangePassword.mockReset();
    mockDeleteAccount.mockReset();
    mockRequestReverification.mockReset();
    mockReauthenticate.mockReset();
    mockPush.mockReset();
  });

  it("renders Your details section with pre-filled values", () => {
    renderProfile();
    expect(screen.getByRole("heading", { name: /your details/i })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Aysha")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Perera")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Aysha P")).toBeInTheDocument();
    expect(screen.getByDisplayValue("+94771234567")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Acme Ltd")).toBeInTheDocument();
  });

  it("renders Saved address section", () => {
    renderProfile();
    expect(screen.getByRole("heading", { name: /saved address/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/address line 1/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/city/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/country/i)).toBeInTheDocument();
  });

  it("renders Change password section", () => {
    renderProfile();
    expect(screen.getByRole("heading", { name: /change password/i })).toBeInTheDocument();
  });

  it("renders Delete account section", () => {
    renderProfile();
    expect(screen.getByRole("heading", { name: /delete account/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /delete account/i })).toBeInTheDocument();
  });
});

// ─── AC2: saving Your details calls updateProfile ────────────────────────────

describe("AC2: saving Your details", () => {
  beforeEach(() => {
    mockUpdateProfile.mockReset();
    mockPush.mockReset();
  });

  it("calls updateProfile with form values and shows toast on success", async () => {
    mockUpdateProfile.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    renderProfile();

    const firstNameInput = screen.getByDisplayValue("Aysha");
    await user.clear(firstNameInput);
    await user.type(firstNameInput, "Nimal");

    await user.click(screen.getByRole("button", { name: /save details/i }));

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith(
        expect.objectContaining({ firstName: "Nimal" })
      );
    });
    expect(screen.getByText(/details saved/i)).toBeInTheDocument();
  });

  it("renders inline error when validation_failed with a field name", async () => {
    mockUpdateProfile.mockResolvedValue({ ok: false, code: "validation_failed", field: "phone" });
    const user = userEvent.setup();
    renderProfile();

    await user.click(screen.getByRole("button", { name: /save details/i }));

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalled();
    });
    // Error should appear near the phone field
    const phoneSection = screen.getByLabelText(/phone/i).closest("div");
    expect(phoneSection).not.toBeNull();
    expect(within(phoneSection!).getByRole("alert")).toBeInTheDocument();
  });
});

// ─── AC3: saving Saved address calls updateProfile with billingAddress ────────

describe("AC3: saving Saved address", () => {
  beforeEach(() => {
    mockUpdateProfile.mockReset();
  });

  it("calls updateProfile({ billingAddress: ... }) and shows toast on success", async () => {
    mockUpdateProfile.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    renderProfile();

    await user.type(screen.getByLabelText(/address line 1/i), "10 Main St");
    await user.type(screen.getByLabelText(/city/i), "Colombo");
    await user.type(screen.getByLabelText(/country/i), "Sri Lanka");

    await user.click(screen.getByRole("button", { name: /save address/i }));

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          billingAddress: expect.objectContaining({
            line1: "10 Main St",
            city: "Colombo",
            country: "Sri Lanka",
          }),
        })
      );
    });
    expect(screen.getByText(/address saved/i)).toBeInTheDocument();
  });
});

// ─── AC4: change password flow ────────────────────────────────────────────────

describe("AC4: change password", () => {
  beforeEach(() => {
    mockChangePassword.mockReset();
    mockReauthenticate.mockReset();
  });

  it("clicking Send code calls supabase.auth.reauthenticate()", async () => {
    mockReauthenticate.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    renderProfile();

    await user.click(screen.getByRole("button", { name: /send code/i }));

    await waitFor(() => {
      expect(mockReauthenticate).toHaveBeenCalled();
    });
    expect(screen.getByLabelText(/reauthentication code/i)).toBeInTheDocument();
  });

  it("submitting calls changePassword with code and new password", async () => {
    mockReauthenticate.mockResolvedValue({ error: null });
    mockChangePassword.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    renderProfile();

    await user.click(screen.getByRole("button", { name: /send code/i }));
    await waitFor(() => expect(screen.getByLabelText(/reauthentication code/i)).toBeInTheDocument());

    await user.type(screen.getByLabelText(/reauthentication code/i), "123456");
    await user.type(screen.getByLabelText(/^new password$/i), "NewPass123!");
    await user.type(screen.getByLabelText(/^confirm new password$/i), "NewPass123!");
    await user.click(screen.getByRole("button", { name: /change password/i }));

    await waitFor(() => {
      expect(mockChangePassword).toHaveBeenCalledWith(
        expect.objectContaining({ code: "123456", newPassword: "NewPass123!" })
      );
    });
    expect(screen.getByText(/password changed/i)).toBeInTheDocument();
  });

  it("shows confirm_mismatch error client-side without calling action", async () => {
    mockReauthenticate.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    renderProfile();

    await user.click(screen.getByRole("button", { name: /send code/i }));
    await waitFor(() => expect(screen.getByLabelText(/reauthentication code/i)).toBeInTheDocument());

    await user.type(screen.getByLabelText(/reauthentication code/i), "123456");
    await user.type(screen.getByLabelText(/^new password$/i), "NewPass123!");
    await user.type(screen.getByLabelText(/^confirm new password$/i), "DifferentPass!");
    await user.click(screen.getByRole("button", { name: /change password/i }));

    expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    expect(mockChangePassword).not.toHaveBeenCalled();
  });

  it("renders code_invalid error on the OTP field", async () => {
    mockReauthenticate.mockResolvedValue({ error: null });
    mockChangePassword.mockResolvedValue({ ok: false, code: "code_invalid" });
    const user = userEvent.setup();
    renderProfile();

    await user.click(screen.getByRole("button", { name: /send code/i }));
    await waitFor(() => expect(screen.getByLabelText(/reauthentication code/i)).toBeInTheDocument());

    await user.type(screen.getByLabelText(/reauthentication code/i), "000000");
    await user.type(screen.getByLabelText(/^new password$/i), "NewPass123!");
    await user.type(screen.getByLabelText(/^confirm new password$/i), "NewPass123!");
    await user.click(screen.getByRole("button", { name: /change password/i }));

    await waitFor(() => {
      expect(screen.getByText(/that code is not right/i)).toBeInTheDocument();
    });
  });
});

// ─── AC5: delete account modal flow ──────────────────────────────────────────

describe("AC5: delete account modal", () => {
  beforeEach(() => {
    mockRequestReverification.mockReset();
    mockDeleteAccount.mockReset();
    mockPush.mockReset();
  });

  it("opens confirmation modal on button click", async () => {
    const user = userEvent.setup();
    renderProfile();

    await user.click(screen.getByRole("button", { name: /delete account/i }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /confirm account deletion/i })).toBeInTheDocument();
  });

  it("send code calls requestReverification with captcha token", async () => {
    mockRequestReverification.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    renderProfile();

    await user.click(screen.getByRole("button", { name: /delete account/i }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /send code/i }));

    await waitFor(() => {
      expect(mockRequestReverification).toHaveBeenCalledWith(
        expect.objectContaining({ captchaToken: "test-captcha-token" })
      );
    });
    expect(within(dialog).getByLabelText(/verification code/i)).toBeInTheDocument();
  });

  it("entering code and confirming calls deleteAccount and redirects home", async () => {
    mockRequestReverification.mockResolvedValue({ ok: true });
    mockDeleteAccount.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    renderProfile();

    await user.click(screen.getByRole("button", { name: /delete account/i }));
    const dialog = screen.getByRole("dialog");

    await user.click(within(dialog).getByRole("button", { name: /send code/i }));
    await waitFor(() => expect(within(dialog).getByLabelText(/verification code/i)).toBeInTheDocument());

    await user.type(within(dialog).getByLabelText(/verification code/i), "654321");
    await user.click(within(dialog).getByRole("button", { name: /delete my account/i }));

    await waitFor(() => {
      expect(mockDeleteAccount).toHaveBeenCalledWith(
        expect.objectContaining({ code: "654321" })
      );
    });
    expect(mockPush).toHaveBeenCalledWith("/");
  });

  it("validation_failed shows blocking-orders message", async () => {
    mockRequestReverification.mockResolvedValue({ ok: true });
    mockDeleteAccount.mockResolvedValue({ ok: false, code: "validation_failed" });
    const user = userEvent.setup();
    renderProfile();

    await user.click(screen.getByRole("button", { name: /delete account/i }));
    const dialog = screen.getByRole("dialog");

    await user.click(within(dialog).getByRole("button", { name: /send code/i }));
    await waitFor(() => expect(within(dialog).getByLabelText(/verification code/i)).toBeInTheDocument());

    await user.type(within(dialog).getByLabelText(/verification code/i), "654321");
    await user.click(within(dialog).getByRole("button", { name: /delete my account/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/pending order or download request/i)
      ).toBeInTheDocument();
    });
  });
});

// ─── AC6: Google-only account disables change password section ────────────────

describe("AC6: Google-only account", () => {
  it("shows static Google note instead of change-password form", () => {
    renderProfile({ isGoogleOnly: true });
    expect(screen.getByText(/you signed in with google/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /send code/i })).toBeNull();
  });
});

// ─── EC1: code_attempts_exceeded on delete resets input ──────────────────────

describe("EC1: code_attempts_exceeded on deleteAccount", () => {
  it("shows too-many-attempts message and clears OTP input", async () => {
    mockRequestReverification.mockResolvedValue({ ok: true });
    mockDeleteAccount.mockResolvedValue({ ok: false, code: "code_attempts_exceeded" });
    const user = userEvent.setup();
    renderProfile();

    await user.click(screen.getByRole("button", { name: /delete account/i }));
    const dialog = screen.getByRole("dialog");

    await user.click(within(dialog).getByRole("button", { name: /send code/i }));
    await waitFor(() => expect(within(dialog).getByLabelText(/verification code/i)).toBeInTheDocument());

    await user.type(within(dialog).getByLabelText(/verification code/i), "111111");
    await user.click(within(dialog).getByRole("button", { name: /delete my account/i }));

    await waitFor(() => {
      expect(screen.getByText(/too many attempts/i)).toBeInTheDocument();
    });
    // OTP input should be reset to empty
    expect(within(dialog).getByLabelText(/verification code/i)).toHaveValue("");
  });
});

// ─── EC2: staff user hides delete account button ─────────────────────────────

describe("EC2: staff user", () => {
  it("hides the Delete account button for staff users", () => {
    renderProfile({ isStaff: true });
    expect(screen.queryByRole("button", { name: /delete account/i })).toBeNull();
    // The heading may still be present but no button
    expect(screen.queryByRole("heading", { name: /delete account/i })).toBeNull();
  });
});
