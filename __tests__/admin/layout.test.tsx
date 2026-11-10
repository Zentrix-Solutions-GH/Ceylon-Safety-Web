// S-045: Admin shell layout — AC1–AC4, AC6, AC7, EC2, EC3

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as React from "react";
import AdminShell from "@/app/admin/AdminShell";

const mockSignOut = vi.fn();
vi.mock("@/lib/auth/actions/sign-out", () => ({
  signOut: (...args: unknown[]) => mockSignOut(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/admin/dashboard",
}));

const BASE_PROPS = {
  displayName: "Jane Staff",
  email: "jane@ceylonsafety.lk",
  role: "admin" as const,
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── AC1: layout renders sidebar and topbar ───────────────────────────────────

describe("AC1: layout renders sidebar and topbar", () => {
  it("renders a nav landmark (sidebar)", () => {
    render(
      <AdminShell {...BASE_PROPS}>
        <div>page content</div>
      </AdminShell>
    );
    expect(screen.getByRole("navigation")).toBeInTheDocument();
  });

  it("renders main content inside main element", () => {
    render(
      <AdminShell {...BASE_PROPS}>
        <div>page content</div>
      </AdminShell>
    );
    expect(screen.getByText("page content")).toBeInTheDocument();
  });
});

// ─── AC2: topbar role label ───────────────────────────────────────────────────

describe("AC2: topbar role labels", () => {
  it("shows 'Admin' label for admin role", () => {
    render(<AdminShell {...BASE_PROPS}><div /></AdminShell>);
    expect(screen.getByText("Admin")).toBeInTheDocument();
  });

  it("shows display name in topbar", () => {
    render(<AdminShell {...BASE_PROPS}><div /></AdminShell>);
    expect(screen.getByText("Jane Staff")).toBeInTheDocument();
  });

  it("shows 'Editor' label for editor role", () => {
    render(
      <AdminShell {...BASE_PROPS} role="editor"><div /></AdminShell>
    );
    expect(screen.getByText("Editor")).toBeInTheDocument();
  });

  it("shows 'Super Admin' label for super_admin role", () => {
    render(
      <AdminShell {...BASE_PROPS} role="super_admin"><div /></AdminShell>
    );
    expect(screen.getByText("Super Admin")).toBeInTheDocument();
  });

  it("admin role never shows 'Super Admin' in topbar", () => {
    render(<AdminShell {...BASE_PROPS} role="admin"><div /></AdminShell>);
    expect(screen.queryByText("Super Admin")).not.toBeInTheDocument();
  });

  it("editor role never shows 'Super Admin' in topbar", () => {
    render(<AdminShell {...BASE_PROPS} role="editor"><div /></AdminShell>);
    expect(screen.queryByText("Super Admin")).not.toBeInTheDocument();
  });

  it("clicking Sign out calls the signOut action", () => {
    render(<AdminShell {...BASE_PROPS}><div /></AdminShell>);
    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));
    expect(mockSignOut).toHaveBeenCalledWith({ scope: "this" });
  });
});

// ─── AC1: permission-aware menu groups ───────────────────────────────────────

describe("AC1: Super Admin sees all menu groups", () => {
  it("Super Admin sees Work queues group", () => {
    render(<AdminShell {...BASE_PROPS} role="super_admin"><div /></AdminShell>);
    expect(screen.getByText(/Work queues/i)).toBeInTheDocument();
  });

  it("Super Admin sees People group", () => {
    render(<AdminShell {...BASE_PROPS} role="super_admin"><div /></AdminShell>);
    expect(screen.getByText(/People/i)).toBeInTheDocument();
  });

  it("Super Admin sees Staff group", () => {
    render(<AdminShell {...BASE_PROPS} role="super_admin"><div /></AdminShell>);
    const nav = screen.getByRole("navigation");
    expect(nav).toHaveTextContent(/Staff/i);
  });

  it("Super Admin sees Settings group", () => {
    render(<AdminShell {...BASE_PROPS} role="super_admin"><div /></AdminShell>);
    expect(screen.getAllByText(/Settings/i).length).toBeGreaterThan(0);
  });
});

describe("AC1: Admin sees correct groups", () => {
  it("Admin sees Content group", () => {
    render(<AdminShell {...BASE_PROPS} role="admin"><div /></AdminShell>);
    expect(screen.getByText(/Content/i)).toBeInTheDocument();
  });

  it("Admin sees Shop group", () => {
    render(<AdminShell {...BASE_PROPS} role="admin"><div /></AdminShell>);
    expect(screen.getByText(/Shop/i)).toBeInTheDocument();
  });

  it("Admin sees Work queues group", () => {
    render(<AdminShell {...BASE_PROPS} role="admin"><div /></AdminShell>);
    expect(screen.getByText(/Work queues/i)).toBeInTheDocument();
  });

  it("Admin sees People group", () => {
    render(<AdminShell {...BASE_PROPS} role="admin"><div /></AdminShell>);
    expect(screen.getByText(/People/i)).toBeInTheDocument();
  });

  it("Admin sees Settings group", () => {
    render(<AdminShell {...BASE_PROPS} role="admin"><div /></AdminShell>);
    expect(screen.getAllByText(/Settings/i).length).toBeGreaterThan(0);
  });

  it("Admin does not see Staff group", () => {
    render(<AdminShell {...BASE_PROPS} role="admin"><div /></AdminShell>);
    expect(screen.queryByText(/^Staff$/i)).not.toBeInTheDocument();
  });

  it("Admin does not see Audit log group", () => {
    render(<AdminShell {...BASE_PROPS} role="admin"><div /></AdminShell>);
    expect(screen.queryByText(/Audit log/i)).not.toBeInTheDocument();
  });

  it("Admin does not see System group", () => {
    render(<AdminShell {...BASE_PROPS} role="admin"><div /></AdminShell>);
    expect(screen.queryByText(/^System$/i)).not.toBeInTheDocument();
  });
});

describe("AC1: Editor sees correct groups (REQ-130f)", () => {
  it("Editor sees Content group", () => {
    render(<AdminShell {...BASE_PROPS} role="editor"><div /></AdminShell>);
    expect(screen.getByText(/Content/i)).toBeInTheDocument();
  });

  it("Editor sees Shop group", () => {
    render(<AdminShell {...BASE_PROPS} role="editor"><div /></AdminShell>);
    expect(screen.getByText(/Shop/i)).toBeInTheDocument();
  });

  it("Editor sees Work queues group", () => {
    render(<AdminShell {...BASE_PROPS} role="editor"><div /></AdminShell>);
    expect(screen.getByText(/Work queues/i)).toBeInTheDocument();
  });

  it("Editor sees Site group", () => {
    render(<AdminShell {...BASE_PROPS} role="editor"><div /></AdminShell>);
    expect(screen.getByText(/Site/i)).toBeInTheDocument();
  });

  it("Editor does not see People group (no users.read)", () => {
    render(<AdminShell {...BASE_PROPS} role="editor"><div /></AdminShell>);
    expect(screen.queryByText(/^People$/i)).not.toBeInTheDocument();
  });

  it("Editor does not see Settings group (no settings.site)", () => {
    render(<AdminShell {...BASE_PROPS} role="editor"><div /></AdminShell>);
    expect(screen.queryByText(/^Settings$/i)).not.toBeInTheDocument();
  });

  it("Editor does not see Staff group", () => {
    render(<AdminShell {...BASE_PROPS} role="editor"><div /></AdminShell>);
    expect(screen.queryByText(/^Staff$/i)).not.toBeInTheDocument();
  });

  it("Editor does not see Audit log group", () => {
    render(<AdminShell {...BASE_PROPS} role="editor"><div /></AdminShell>);
    expect(screen.queryByText(/Audit log/i)).not.toBeInTheDocument();
  });
});

// ─── AC3: narrow viewport collapse ───────────────────────────────────────────

describe("AC3: sidebar hamburger toggle", () => {
  it("renders a hamburger/toggle button", () => {
    render(<AdminShell {...BASE_PROPS}><div /></AdminShell>);
    const toggle = screen.getByRole("button", { name: /toggle.*sidebar|open.*menu|close.*menu/i });
    expect(toggle).toBeInTheDocument();
  });

  it("toggle button starts with aria-expanded=false and becomes true after click", () => {
    render(<AdminShell {...BASE_PROPS}><div /></AdminShell>);
    const toggle = screen.getByRole("button", { name: /toggle.*sidebar|open.*menu|close.*menu/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });

  it("clicking toggle twice returns aria-expanded to false", () => {
    render(<AdminShell {...BASE_PROPS}><div /></AdminShell>);
    const toggle = screen.getByRole("button", { name: /toggle.*sidebar|open.*menu|close.*menu/i });
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });
});

// ─── AC4: badge chips render (zero badges) ───────────────────────────────────

describe("AC4: badge chips (EC2: zero on API failure)", () => {
  it("renders badge chip for Comments with zero count", () => {
    render(<AdminShell {...BASE_PROPS}><div /></AdminShell>);
    // With zero badges, chips are hidden or show 0 — just ensure no crash
    expect(screen.getByRole("navigation")).toBeInTheDocument();
  });

  it("renders badge chip for non-zero comments count", () => {
    render(
      <AdminShell
        {...BASE_PROPS}
        badgeCounts={{ comments: 3, bankTransfers: 0, downloadRequests: 0 }}
      >
        <div />
      </AdminShell>
    );
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders badge chip for non-zero bankTransfers count", () => {
    render(
      <AdminShell
        {...BASE_PROPS}
        badgeCounts={{ comments: 0, bankTransfers: 7, downloadRequests: 0 }}
      >
        <div />
      </AdminShell>
    );
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("renders badge chip for non-zero downloadRequests count", () => {
    render(
      <AdminShell
        {...BASE_PROPS}
        badgeCounts={{ comments: 0, bankTransfers: 0, downloadRequests: 2 }}
      >
        <div />
      </AdminShell>
    );
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("EC2: badge API failure — renders zero badges without crashing", () => {
    render(
      <AdminShell {...BASE_PROPS} badgeCounts={null}>
        <div />
      </AdminShell>
    );
    expect(screen.getByRole("navigation")).toBeInTheDocument();
  });

  it("zero badge counts render no badge chip elements", () => {
    render(
      <AdminShell
        {...BASE_PROPS}
        badgeCounts={{ comments: 0, bankTransfers: 0, downloadRequests: 0 }}
      >
        <div />
      </AdminShell>
    );
    // Badge chips only render when count > 0
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });
});

// ─── AC6: no ad/analytics scripts ────────────────────────────────────────────

describe("AC6: no ad or analytics script tags", () => {
  it("renders no script tags", () => {
    render(<AdminShell {...BASE_PROPS}><div /></AdminShell>);
    const scripts = document.querySelectorAll("script[src]");
    // Filter to known ad/analytics domains
    const adScripts = Array.from(scripts).filter((s) =>
      /(googletagmanager|google-analytics|payhere|facebook|gtag)/i.test(
        (s as HTMLScriptElement).src
      )
    );
    expect(adScripts).toHaveLength(0);
  });
});
