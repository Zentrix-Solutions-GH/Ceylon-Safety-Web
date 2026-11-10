// S-046: Staff screen — AC1–AC7, EC1–EC6

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as React from "react";
import type { StaffListItem } from "@/types/role";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockGrantRole = vi.fn();
const mockRemoveRole = vi.fn();
const mockListStaff = vi.fn();
const mockFindUserByEmail = vi.fn();
const mockRedirect = vi.fn();

vi.mock("@/lib/admin/actions/staff-roles", () => ({
  grantRole: (...args: unknown[]) => mockGrantRole(...args),
  removeRole: (...args: unknown[]) => mockRemoveRole(...args),
  listStaff: (...args: unknown[]) => mockListStaff(...args),
  findUserByEmail: (...args: unknown[]) => mockFindUserByEmail(...args),
}));

vi.mock("@/lib/config.ts", () => ({
  config: {
    supabaseUrl: "http://localhost:54321",
    supabaseAnonKey: "test-anon-key",
    supabaseServiceRoleKey: "test-service-role-key",
    appUrl: "http://localhost:3000",
    nextServerActionsEncryptionKey: "test-encryption-key",
    cronSecret: "test-cron-secret",
    resendApiKey: "test-resend-key",
    emailFrom: "test@test.com",
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/admin/staff",
  redirect: (...args: unknown[]) => mockRedirect(...args),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const CURRENT_USER_ID = "current-super-admin-id";

const STAFF_ROWS: StaffListItem[] = [
  {
    userId: "user-admin-1",
    email: "admin@ceylonsafety.lk",
    role: "admin",
    lastSignInAt: "2026-11-09T10:00:00Z",
    hasTotpEnrolled: true,
  },
  {
    userId: "user-editor-1",
    email: "editor@ceylonsafety.lk",
    role: "editor",
    lastSignInAt: null,
    hasTotpEnrolled: false,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockListStaff.mockResolvedValue({ ok: true, staff: STAFF_ROWS });
  mockFindUserByEmail.mockResolvedValue({ ok: true, userId: "resolved-user-id" });
});

// ─── AC1: access control ──────────────────────────────────────────────────────

describe("AC1: page requires Super Admin", () => {
  it("renders page with data for a valid Super Admin session", async () => {
    const { StaffPageClient } = await import(
      "@/app/admin/staff/StaffPageClient"
    );
    render(<StaffPageClient initialStaff={STAFF_ROWS} currentUserId={CURRENT_USER_ID} />);
    expect(screen.getByText("admin@ceylonsafety.lk")).toBeInTheDocument();
  });

  it("renders empty state when listStaff returns not_allowed", async () => {
    mockListStaff.mockResolvedValue({ ok: false, code: "not_allowed" });
    const { StaffPageClient } = await import(
      "@/app/admin/staff/StaffPageClient"
    );
    render(<StaffPageClient initialStaff={[]} currentUserId={CURRENT_USER_ID} />);
    expect(screen.getByText(/no staff members yet/i)).toBeInTheDocument();
  });
});

// ─── AC2: staff list renders correctly ───────────────────────────────────────

describe("AC2: staff list renders", () => {
  it("shows email for each row", async () => {
    const { StaffPageClient } = await import(
      "@/app/admin/staff/StaffPageClient"
    );
    render(<StaffPageClient initialStaff={STAFF_ROWS} currentUserId={CURRENT_USER_ID} />);
    expect(screen.getByText("admin@ceylonsafety.lk")).toBeInTheDocument();
    expect(screen.getByText("editor@ceylonsafety.lk")).toBeInTheDocument();
  });

  it("shows role label for each row", async () => {
    const { StaffPageClient } = await import(
      "@/app/admin/staff/StaffPageClient"
    );
    render(<StaffPageClient initialStaff={STAFF_ROWS} currentUserId={CURRENT_USER_ID} />);
    expect(screen.getAllByText("Admin").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Editor").length).toBeGreaterThan(0);
  });

  it("shows TOTP warning badge for unenrolled staff", async () => {
    const { StaffPageClient } = await import(
      "@/app/admin/staff/StaffPageClient"
    );
    render(<StaffPageClient initialStaff={STAFF_ROWS} currentUserId={CURRENT_USER_ID} />);
    expect(screen.getByTestId("totp-warning-user-editor-1")).toBeInTheDocument();
  });

  it("does not show TOTP warning for enrolled staff", async () => {
    const { StaffPageClient } = await import(
      "@/app/admin/staff/StaffPageClient"
    );
    render(<StaffPageClient initialStaff={STAFF_ROWS} currentUserId={CURRENT_USER_ID} />);
    expect(screen.queryByTestId("totp-warning-user-admin-1")).not.toBeInTheDocument();
  });
});

// ─── AC3: add staff member ────────────────────────────────────────────────────

describe("AC3: add staff member", () => {
  it("resolves email to userId then calls grantRole with role and totpCode", async () => {
    mockGrantRole.mockResolvedValue({ ok: true });

    const { AddStaffDialog } = await import(
      "@/components/admin/AddStaffDialog"
    );
    render(<AddStaffDialog onSuccess={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /add staff/i }));
    await userEvent.type(screen.getByLabelText(/email/i), "new@ceylonsafety.lk");
    await userEvent.type(screen.getByLabelText(/authenticator code/i), "123456");
    fireEvent.click(screen.getByRole("button", { name: /grant role/i }));

    await waitFor(() => {
      expect(mockFindUserByEmail).toHaveBeenCalledWith({ email: "new@ceylonsafety.lk" });
      expect(mockGrantRole).toHaveBeenCalledWith({
        userId: "resolved-user-id",
        role: "admin",
        totpCode: "123456",
      });
    });
  });

  it("shows not_found error when findUserByEmail returns not_found", async () => {
    mockFindUserByEmail.mockResolvedValue({ ok: false, code: "not_found" });

    const { AddStaffDialog } = await import(
      "@/components/admin/AddStaffDialog"
    );
    render(<AddStaffDialog onSuccess={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /add staff/i }));
    await userEvent.type(screen.getByLabelText(/email/i), "ghost@example.com");
    await userEvent.type(screen.getByLabelText(/authenticator code/i), "123456");
    fireEvent.click(screen.getByRole("button", { name: /grant role/i }));

    await waitFor(() => {
      expect(screen.getByText(/the person must sign up first/i)).toBeInTheDocument();
    });
  });

  it("shows validation_failed error message for existing staff", async () => {
    mockGrantRole.mockResolvedValue({ ok: false, code: "validation_failed" });

    const { AddStaffDialog } = await import(
      "@/components/admin/AddStaffDialog"
    );
    render(<AddStaffDialog onSuccess={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /add staff/i }));
    await userEvent.type(screen.getByLabelText(/email/i), "existing@ceylonsafety.lk");
    await userEvent.type(screen.getByLabelText(/authenticator code/i), "123456");
    fireEvent.click(screen.getByRole("button", { name: /grant role/i }));

    await waitFor(() => {
      expect(screen.getByText(/already has a staff role/i)).toBeInTheDocument();
    });
  });
});

// ─── AC4: remove staff ────────────────────────────────────────────────────────

describe("AC4: remove staff member", () => {
  it("calls removeRole with userId and totpCode on confirm", async () => {
    mockRemoveRole.mockResolvedValue({ ok: true });

    const { RemoveStaffDialog } = await import(
      "@/components/admin/RemoveStaffDialog"
    );
    render(
      <RemoveStaffDialog
        open={true}
        userId="user-admin-1"
        email="admin@ceylonsafety.lk"
        isSelf={false}
        onSuccess={vi.fn()}
        onClose={vi.fn()}
      />
    );

    await userEvent.type(screen.getByLabelText(/authenticator code/i), "654321");
    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));

    await waitFor(() => {
      expect(mockRemoveRole).toHaveBeenCalledWith({
        userId: "user-admin-1",
        totpCode: "654321",
      });
    });
  });

  it("shows not_allowed_super_admin message when isSelf=false and not_allowed returned", async () => {
    mockRemoveRole.mockResolvedValue({ ok: false, code: "not_allowed" });

    const { RemoveStaffDialog } = await import(
      "@/components/admin/RemoveStaffDialog"
    );
    render(
      <RemoveStaffDialog
        open={true}
        userId="user-admin-1"
        email="admin@ceylonsafety.lk"
        isSelf={false}
        onSuccess={vi.fn()}
        onClose={vi.fn()}
      />
    );

    await userEvent.type(screen.getByLabelText(/authenticator code/i), "654321");
    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));

    await waitFor(() => {
      expect(screen.getByText(/cannot remove a super admin/i)).toBeInTheDocument();
    });
  });
});

// ─── AC5: role change ─────────────────────────────────────────────────────────

describe("AC5: role change", () => {
  it("calls grantRole with new role and totpCode on role change", async () => {
    mockGrantRole.mockResolvedValue({ ok: true });

    const { StaffTable } = await import("@/components/admin/StaffTable");
    render(
      <StaffTable
        staff={STAFF_ROWS}
        currentUserId={CURRENT_USER_ID}
        onRefresh={vi.fn()}
      />
    );

    const roleSelect = screen.getAllByRole("combobox")[0];
    await userEvent.selectOptions(roleSelect, "editor");

    await userEvent.type(screen.getByLabelText(/authenticator code/i), "111222");
    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));

    await waitFor(() => {
      expect(mockGrantRole).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "user-admin-1", role: "editor", totpCode: "111222" })
      );
    });
  });
});

// ─── AC7: sidebar Staff link hidden for non-super-admin ───────────────────────

describe("AC7: sidebar Staff link visibility", () => {
  it("hides Staff group for admin role", async () => {
    const AdminSidebar = (await import("@/app/admin/AdminSidebar")).default;
    render(
      <AdminSidebar role="admin" badgeCounts={null} open={true} onClose={vi.fn()} />
    );
    expect(screen.queryByText("Staff")).not.toBeInTheDocument();
  });

  it("hides Staff group for editor role", async () => {
    const AdminSidebar = (await import("@/app/admin/AdminSidebar")).default;
    render(
      <AdminSidebar role="editor" badgeCounts={null} open={true} onClose={vi.fn()} />
    );
    expect(screen.queryByText("Staff")).not.toBeInTheDocument();
  });

  it("shows Staff group for super_admin role", async () => {
    const AdminSidebar = (await import("@/app/admin/AdminSidebar")).default;
    render(
      <AdminSidebar role="super_admin" badgeCounts={null} open={true} onClose={vi.fn()} />
    );
    expect(screen.getAllByText("Staff").length).toBeGreaterThan(0);
  });
});

// ─── EC1: cannot remove own role ─────────────────────────────────────────────

describe("EC1: cannot remove own role", () => {
  it("shows 'cannot remove your own role' when isSelf=true and not_allowed returned", async () => {
    mockRemoveRole.mockResolvedValue({ ok: false, code: "not_allowed" });

    const { RemoveStaffDialog } = await import(
      "@/components/admin/RemoveStaffDialog"
    );
    render(
      <RemoveStaffDialog
        open={true}
        userId={CURRENT_USER_ID}
        email="me@ceylonsafety.lk"
        isSelf={true}
        onSuccess={vi.fn()}
        onClose={vi.fn()}
      />
    );

    await userEvent.type(screen.getByLabelText(/authenticator code/i), "000000");
    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));

    await waitFor(() => {
      expect(screen.getByText(/cannot remove your own role/i)).toBeInTheDocument();
    });
  });

  it("StaffTable passes isSelf=true when removing current user", async () => {
    mockRemoveRole.mockResolvedValue({ ok: false, code: "not_allowed" });

    const { StaffTable } = await import("@/components/admin/StaffTable");
    const selfStaff: StaffListItem[] = [
      { userId: CURRENT_USER_ID, email: "me@ceylonsafety.lk", role: "admin", lastSignInAt: null, hasTotpEnrolled: true },
    ];
    render(
      <StaffTable staff={selfStaff} currentUserId={CURRENT_USER_ID} onRefresh={vi.fn()} />
    );

    fireEvent.click(screen.getByRole("button", { name: /remove/i }));
    await userEvent.type(screen.getByLabelText(/authenticator code/i), "000000");
    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));

    await waitFor(() => {
      expect(screen.getByText(/cannot remove your own role/i)).toBeInTheDocument();
    });
  });
});

// ─── EC3: incorrect TOTP code ─────────────────────────────────────────────────

describe("EC3: incorrect TOTP code", () => {
  it("shows inline error when server action throws on bad TOTP", async () => {
    mockFindUserByEmail.mockResolvedValue({ ok: true, userId: "some-id" });
    mockGrantRole.mockRejectedValue(new Error("code_invalid"));

    const { AddStaffDialog } = await import(
      "@/components/admin/AddStaffDialog"
    );
    render(<AddStaffDialog onSuccess={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /add staff/i }));
    await userEvent.type(screen.getByLabelText(/email/i), "test@ceylonsafety.lk");
    await userEvent.type(screen.getByLabelText(/authenticator code/i), "000000");
    fireEvent.click(screen.getByRole("button", { name: /grant role/i }));

    await waitFor(() => {
      expect(screen.getByText(/incorrect authenticator code/i)).toBeInTheDocument();
    });
  });
});

// ─── EC5: race condition — role row already gone ──────────────────────────────

describe("EC5: remove race condition", () => {
  it("shows refresh message when removeRole returns not_found", async () => {
    mockRemoveRole.mockResolvedValue({ ok: false, code: "not_found" });

    const { RemoveStaffDialog } = await import(
      "@/components/admin/RemoveStaffDialog"
    );
    render(
      <RemoveStaffDialog
        open={true}
        userId="user-admin-1"
        email="admin@ceylonsafety.lk"
        isSelf={false}
        onSuccess={vi.fn()}
        onClose={vi.fn()}
      />
    );

    await userEvent.type(screen.getByLabelText(/authenticator code/i), "654321");
    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));

    await waitFor(() => {
      expect(screen.getByText(/refresh and try again/i)).toBeInTheDocument();
    });
  });
});

// ─── EC6: unknown error ───────────────────────────────────────────────────────

describe("EC6: unknown error", () => {
  it("shows 'something went wrong' when grantRole returns unknown", async () => {
    mockGrantRole.mockResolvedValue({ ok: false, code: "unknown" });

    const { AddStaffDialog } = await import(
      "@/components/admin/AddStaffDialog"
    );
    render(<AddStaffDialog onSuccess={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /add staff/i }));
    await userEvent.type(screen.getByLabelText(/email/i), "test@ceylonsafety.lk");
    await userEvent.type(screen.getByLabelText(/authenticator code/i), "123456");
    fireEvent.click(screen.getByRole("button", { name: /grant role/i }));

    await waitFor(() => {
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });
  });

  it("shows 'something went wrong' when removeRole returns unknown", async () => {
    mockRemoveRole.mockResolvedValue({ ok: false, code: "unknown" });

    const { RemoveStaffDialog } = await import(
      "@/components/admin/RemoveStaffDialog"
    );
    render(
      <RemoveStaffDialog
        open={true}
        userId="user-admin-1"
        email="admin@ceylonsafety.lk"
        isSelf={false}
        onSuccess={vi.fn()}
        onClose={vi.fn()}
      />
    );

    await userEvent.type(screen.getByLabelText(/authenticator code/i), "654321");
    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));

    await waitFor(() => {
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });
  });
});

// ─── P2: formatDate helper ────────────────────────────────────────────────────

describe("formatDate via StaffTable render", () => {
  it("shows 'Never' when lastSignInAt is null", async () => {
    const { StaffTable } = await import("@/components/admin/StaffTable");
    const neverRow: StaffListItem[] = [
      { userId: "u1", email: "x@example.com", role: "editor", lastSignInAt: null, hasTotpEnrolled: true },
    ];
    render(<StaffTable staff={neverRow} currentUserId="other" onRefresh={vi.fn()} />);
    expect(screen.getByText(/never/i)).toBeInTheDocument();
  });

  it("formats a known ISO date as a locale string", async () => {
    const { StaffTable } = await import("@/components/admin/StaffTable");
    const dateRow: StaffListItem[] = [
      { userId: "u2", email: "y@example.com", role: "admin", lastSignInAt: "2026-11-09T10:00:00Z", hasTotpEnrolled: true },
    ];
    render(<StaffTable staff={dateRow} currentUserId="other" onRefresh={vi.fn()} />);
    // toLocaleDateString with en-GB produces "09 Nov 2026" — verify year is present
    expect(screen.getByText(/2026/)).toBeInTheDocument();
  });
});
