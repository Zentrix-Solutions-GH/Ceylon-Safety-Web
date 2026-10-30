import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// jsdom does not implement matchMedia or ResizeObserver — both needed by Radix Sheet.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
  useRouter: vi.fn(() => ({ push: vi.fn() })),
  useParams: vi.fn(() => ({})),
}));

import Header from "../Header";
import { useAuth } from "@/hooks/useAuth";
import { usePathname } from "next/navigation";

const mockUseAuth = vi.mocked(useAuth);
const mockUsePathname = vi.mocked(usePathname);

describe("Header", () => {
  let mockSignOut: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockSignOut = vi.fn().mockResolvedValue(undefined);
    mockUsePathname.mockReturnValue("/");
    mockUseAuth.mockReturnValue({ user: null, isLoading: false, signOut: mockSignOut });
  });

  describe("EC6: text wordmark", () => {
    it("renders the CeylonSafety text wordmark", () => {
      render(<Header />);
      expect(screen.getByText("CeylonSafety")).toBeInTheDocument();
    });
  });

  describe("AC1: nav links", () => {
    it("renders all 6 main nav items", () => {
      render(<Header />);
      expect(screen.getAllByRole("link", { name: "Home" }).length).toBeGreaterThan(0);
      expect(screen.getAllByRole("link", { name: "Articles" }).length).toBeGreaterThan(0);
      expect(screen.getAllByRole("link", { name: "Documents" }).length).toBeGreaterThan(0);
      expect(screen.getAllByRole("link", { name: "Courses" }).length).toBeGreaterThan(0);
      expect(screen.getAllByRole("link", { name: "Jobs" }).length).toBeGreaterThan(0);
      expect(screen.getAllByRole("link", { name: "Contact Coach" }).length).toBeGreaterThan(0);
    });

    it("renders nav links in the correct order", () => {
      render(<Header />);
      const nav = screen.getByRole("navigation", { name: /site navigation/i });
      const links = Array.from(nav.querySelectorAll("a"));
      const texts = links.map((l) => l.textContent?.trim());
      const homeIdx = texts.indexOf("Home");
      const articlesIdx = texts.indexOf("Articles");
      const documentsIdx = texts.indexOf("Documents");
      const coursesIdx = texts.indexOf("Courses");
      const jobsIdx = texts.indexOf("Jobs");
      const contactIdx = texts.indexOf("Contact Coach");
      expect(homeIdx).toBeLessThan(articlesIdx);
      expect(articlesIdx).toBeLessThan(documentsIdx);
      expect(documentsIdx).toBeLessThan(coursesIdx);
      expect(coursesIdx).toBeLessThan(jobsIdx);
      expect(jobsIdx).toBeLessThan(contactIdx);
    });

    it("sets aria-current=page on the active link", () => {
      mockUsePathname.mockReturnValue("/articles");
      render(<Header />);
      const nav = screen.getByRole("navigation", { name: /site navigation/i });
      const articlesLink = nav.querySelector('a[href="/articles"]');
      expect(articlesLink).toHaveAttribute("aria-current", "page");
    });

    it("does not set aria-current on inactive links", () => {
      mockUsePathname.mockReturnValue("/articles");
      render(<Header />);
      const nav = screen.getByRole("navigation", { name: /site navigation/i });
      const homeLink = nav.querySelector('a[href="/"]');
      expect(homeLink).not.toHaveAttribute("aria-current", "page");
    });
  });

  describe("AC2: placeholder while session loads", () => {
    it("hides Sign In and Sign Up while loading, shows aria-busy placeholder", () => {
      mockUseAuth.mockReturnValue({ user: null, isLoading: true, signOut: mockSignOut });
      render(<Header />);
      expect(screen.queryByRole("link", { name: "Sign In" })).toBeNull();
      expect(screen.queryByRole("link", { name: "Sign Up" })).toBeNull();
      expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    });
  });

  describe("AC3: signed-out state", () => {
    it("shows Sign In and Sign Up links", () => {
      render(<Header />);
      expect(screen.getByRole("link", { name: "Sign In" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Sign Up" })).toBeInTheDocument();
    });

    it("Sign In links to /sign-in and Sign Up links to /sign-up", () => {
      render(<Header />);
      expect(screen.getByRole("link", { name: "Sign In" })).toHaveAttribute("href", "/sign-in");
      expect(screen.getByRole("link", { name: "Sign Up" })).toHaveAttribute("href", "/sign-up");
    });
  });

  describe("AC3: signed-in state", () => {
    it("shows the user name when signed in", () => {
      mockUseAuth.mockReturnValue({ user: { name: "Kamal" }, isLoading: false, signOut: mockSignOut });
      render(<Header />);
      expect(screen.getByText("Kamal")).toBeInTheDocument();
    });

    it("calls signOut when the Sign out button is clicked", async () => {
      const user = userEvent.setup();
      mockUseAuth.mockReturnValue({ user: { name: "Kamal" }, isLoading: false, signOut: mockSignOut });
      render(<Header />);
      await user.click(screen.getByRole("button", { name: "Kamal" }));
      await user.click(screen.getByRole("menuitem", { name: /sign out/i }));
      expect(mockSignOut).toHaveBeenCalledOnce();
    });

    it("closes the menu after successful sign-out", async () => {
      const user = userEvent.setup();
      mockUseAuth.mockReturnValue({ user: { name: "Kamal" }, isLoading: false, signOut: mockSignOut });
      render(<Header />);
      await user.click(screen.getByRole("button", { name: "Kamal" }));
      expect(screen.getByRole("menu")).toBeInTheDocument();
      await user.click(screen.getByRole("menuitem", { name: /sign out/i }));
      await waitFor(() => {
        expect(screen.queryByRole("menu")).toBeNull();
      });
    });
  });

  describe("AC4: cart link", () => {
    it("renders a cart link pointing to /cart", () => {
      render(<Header />);
      const cartLink = screen.getByRole("link", { name: /cart/i });
      expect(cartLink).toHaveAttribute("href", "/cart");
    });
  });

  describe("AC5: mobile sheet", () => {
    it("has an Open menu button", () => {
      render(<Header />);
      expect(screen.getByRole("button", { name: /open menu/i })).toBeInTheDocument();
    });

    it("opens a dialog sheet when the menu button is clicked", async () => {
      const user = userEvent.setup();
      render(<Header />);
      await user.click(screen.getByRole("button", { name: /open menu/i }));
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("closes the dialog when Escape is pressed", async () => {
      const user = userEvent.setup();
      render(<Header />);
      await user.click(screen.getByRole("button", { name: /open menu/i }));
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      await user.keyboard("{Escape}");
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).toBeNull();
      });
    });

    it("returns focus to the open menu button after Escape closes the sheet", async () => {
      const user = userEvent.setup();
      render(<Header />);
      const openBtn = screen.getByRole("button", { name: /open menu/i });
      await user.click(openBtn);
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      await user.keyboard("{Escape}");
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).toBeNull();
      });
      await waitFor(() => {
        expect(document.activeElement).toBe(openBtn);
      });
    });
  });

  describe("EC2: user with no display name", () => {
    it("shows Account when the signed-in user has no name", () => {
      mockUseAuth.mockReturnValue({ user: { name: null }, isLoading: false, signOut: mockSignOut });
      render(<Header />);
      expect(screen.getByRole("button", { name: "Account" })).toBeInTheDocument();
    });
  });

  describe("EC3: long display name", () => {
    it("truncates a long display name", () => {
      mockUseAuth.mockReturnValue({
        user: { name: "Thisarathna Jayawickrama" },
        isLoading: false,
        signOut: mockSignOut,
      });
      render(<Header />);
      const nameBtn = screen.getByRole("button", { name: "Thisarathna Jayawickrama" });
      // The name span inside the button should have the truncate class.
      const truncEl = nameBtn.querySelector(".truncate") ?? nameBtn;
      expect(truncEl).toHaveClass("truncate");
    });
  });

  describe("EC4: resize to desktop closes mobile sheet", () => {
    let origMatchMedia: typeof window.matchMedia;
    beforeEach(() => { origMatchMedia = window.matchMedia; });
    afterEach(() => { window.matchMedia = origMatchMedia; });

    it("closes the sheet when the viewport widens to desktop", async () => {
      const handlers: Array<(e: { matches: boolean }) => void> = [];
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn().mockImplementation(
          (event: string, handler: (e: { matches: boolean }) => void) => {
            if (event === "change") handlers.push(handler);
          }
        ),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      const user = userEvent.setup();
      render(<Header />);
      await user.click(screen.getByRole("button", { name: /open menu/i }));
      expect(screen.getByRole("dialog")).toBeInTheDocument();

      act(() => {
        handlers.forEach((h) => h({ matches: true } as MediaQueryListEvent));
      });

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).toBeNull();
      });

    });
  });

  describe("EC5: sign-out error", () => {
    it("shows an error alert when sign out fails", async () => {
      const user = userEvent.setup();
      const failingSignOut = vi.fn().mockRejectedValue(new Error("offline"));
      mockUseAuth.mockReturnValue({ user: { name: "Kamal" }, isLoading: false, signOut: failingSignOut });
      render(<Header />);
      await user.click(screen.getByRole("button", { name: "Kamal" }));
      await user.click(screen.getByRole("menuitem", { name: /sign out/i }));
      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
      });
    });

    it("clears the sign-out error when the menu is closed", async () => {
      const user = userEvent.setup();
      const failingSignOut = vi.fn().mockRejectedValue(new Error("offline"));
      mockUseAuth.mockReturnValue({ user: { name: "Kamal" }, isLoading: false, signOut: failingSignOut });
      render(<Header />);
      await user.click(screen.getByRole("button", { name: "Kamal" }));
      await user.click(screen.getByRole("menuitem", { name: /sign out/i }));
      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
      });
      await user.keyboard("{Escape}");
      await waitFor(() => {
        expect(screen.queryByRole("alert")).toBeNull();
      });
    });
  });

  describe("account dropdown: keyboard navigation", () => {
    it("arrow keys cycle focus between menu items", async () => {
      const user = userEvent.setup();
      mockUseAuth.mockReturnValue({ user: { name: "Kamal" }, isLoading: false, signOut: mockSignOut });
      render(<Header />);
      await user.click(screen.getByRole("button", { name: "Kamal" }));
      const items = screen.getAllByRole("menuitem");
      items[0].focus();
      await user.keyboard("{ArrowDown}");
      expect(document.activeElement).toBe(items[1]);
      await user.keyboard("{ArrowDown}");
      expect(document.activeElement).toBe(items[2]);
      await user.keyboard("{ArrowDown}");
      expect(document.activeElement).toBe(items[0]);
    });

    it("Escape closes dropdown and returns focus to account button", async () => {
      const user = userEvent.setup();
      mockUseAuth.mockReturnValue({ user: { name: "Kamal" }, isLoading: false, signOut: mockSignOut });
      render(<Header />);
      const accountBtn = screen.getByRole("button", { name: "Kamal" });
      await user.click(accountBtn);
      const items = screen.getAllByRole("menuitem");
      items[0].focus();
      await user.keyboard("{Escape}");
      await waitFor(() => {
        expect(screen.queryByRole("menu")).toBeNull();
      });
      expect(document.activeElement).toBe(accountBtn);
    });

    it("Tab closes dropdown and returns focus to account button", async () => {
      const user = userEvent.setup();
      mockUseAuth.mockReturnValue({ user: { name: "Kamal" }, isLoading: false, signOut: mockSignOut });
      render(<Header />);
      const accountBtn = screen.getByRole("button", { name: "Kamal" });
      await user.click(accountBtn);
      const items = screen.getAllByRole("menuitem");
      items[0].focus();
      await user.keyboard("{Tab}");
      await waitFor(() => {
        expect(screen.queryByRole("menu")).toBeNull();
      });
      expect(document.activeElement).toBe(accountBtn);
    });
  });

  describe("EC5: sign-out race guard", () => {
    it("click-outside while sign-out is in-flight does not swallow the error", async () => {
      let rejectSignOut!: (e: Error) => void;
      const slowSignOut = vi.fn().mockImplementation(
        () => new Promise<void>((_, reject) => { rejectSignOut = reject; })
      );
      mockUseAuth.mockReturnValue({ user: { name: "Kamal" }, isLoading: false, signOut: slowSignOut });
      render(<Header />);

      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Kamal" }));

      // Start sign-out directly so isSigningOut.current is set before we return.
      act(() => { screen.getByRole("menuitem", { name: /sign out/i }).click(); });

      // Fire mousedown outside while sign-out is in-flight — guard should block close.
      act(() => {
        document.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      });
      expect(screen.getByRole("menu")).toBeInTheDocument();

      // Fail sign-out — error must appear inside the still-open menu.
      await act(async () => { rejectSignOut(new Error("offline")); });
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    it("Escape during sign-out does not close the menu or swallow the error", async () => {
      let rejectSignOut!: (e: Error) => void;
      const slowSignOut = vi.fn().mockImplementation(
        () => new Promise<void>((_, reject) => { rejectSignOut = reject; })
      );
      mockUseAuth.mockReturnValue({ user: { name: "Kamal" }, isLoading: false, signOut: slowSignOut });
      render(<Header />);

      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Kamal" }));

      act(() => { screen.getByRole("menuitem", { name: /sign out/i }).click(); });

      // Press Escape while sign-out is in-flight — closeMenu() guard should block.
      act(() => { fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" }); });
      expect(screen.getByRole("menu")).toBeInTheDocument();

      await act(async () => { rejectSignOut(new Error("offline")); });
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    it("Tab during sign-out does not close the menu or swallow the error", async () => {
      let rejectSignOut!: (e: Error) => void;
      const slowSignOut = vi.fn().mockImplementation(
        () => new Promise<void>((_, reject) => { rejectSignOut = reject; })
      );
      mockUseAuth.mockReturnValue({ user: { name: "Kamal" }, isLoading: false, signOut: slowSignOut });
      render(<Header />);

      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Kamal" }));

      act(() => { screen.getByRole("menuitem", { name: /sign out/i }).click(); });

      // Press Tab while sign-out is in-flight — closeMenu() guard should block.
      act(() => { fireEvent.keyDown(screen.getByRole("menu"), { key: "Tab" }); });
      expect(screen.getByRole("menu")).toBeInTheDocument();

      await act(async () => { rejectSignOut(new Error("offline")); });
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });

  describe("EC5: unmount during in-flight sign-out (isMounted guard)", () => {
    it("unmounting while sign-out succeeds does not throw", async () => {
      let resolveSignOut!: () => void;
      const slowSignOut = vi.fn().mockImplementation(
        () => new Promise<void>((resolve) => { resolveSignOut = resolve; })
      );
      mockUseAuth.mockReturnValue({ user: { name: "Kamal" }, isLoading: false, signOut: slowSignOut });
      const { unmount } = render(<Header />);

      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Kamal" }));
      act(() => { screen.getByRole("menuitem", { name: /sign out/i }).click(); });

      unmount();

      // sign-out resolves after unmount — isMounted guard prevents setState crash
      await act(async () => { resolveSignOut(); });
    });

    it("unmounting while sign-out fails does not throw", async () => {
      let rejectSignOut!: (e: Error) => void;
      const slowSignOut = vi.fn().mockImplementation(
        () => new Promise<void>((_, reject) => { rejectSignOut = reject; })
      );
      mockUseAuth.mockReturnValue({ user: { name: "Kamal" }, isLoading: false, signOut: slowSignOut });
      const { unmount } = render(<Header />);

      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Kamal" }));
      act(() => { screen.getByRole("menuitem", { name: /sign out/i }).click(); });

      unmount();

      // sign-out fails after unmount — isMounted guard prevents setState; no unhandled error
      await act(async () => { rejectSignOut(new Error("offline")); });
    });
  });

  describe("account dropdown: click-outside closes menu", () => {
    it("closes the dropdown when clicking outside it", async () => {
      const user = userEvent.setup();
      mockUseAuth.mockReturnValue({ user: { name: "Kamal" }, isLoading: false, signOut: mockSignOut });
      render(<Header />);
      await user.click(screen.getByRole("button", { name: "Kamal" }));
      expect(screen.getByRole("menu")).toBeInTheDocument();
      await user.click(document.body);
      await waitFor(() => {
        expect(screen.queryByRole("menu")).toBeNull();
      });
    });
  });
});
