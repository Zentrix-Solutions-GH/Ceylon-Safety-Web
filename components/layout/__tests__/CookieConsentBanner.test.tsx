import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/consent", () => ({
  getConsent: vi.fn(),
  setConsent: vi.fn(() => ({ ok: true })),
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import CookieConsentBanner from "../CookieConsentBanner";
import { getConsent, setConsent } from "@/lib/consent";

const mockGetConsent = vi.mocked(getConsent);
const mockSetConsent = vi.mocked(setConsent);

beforeEach(() => {
  mockSetConsent.mockReturnValue({ ok: true });
  document.body.style.paddingBottom = "";
  document.documentElement.style.scrollPaddingBottom = "";
});

afterEach(() => {
  vi.clearAllMocks();
  document.body.style.paddingBottom = "";
  document.documentElement.style.scrollPaddingBottom = "";
});

describe("AC1: shows only when undecided", () => {
  it("renders the banner when consent is undecided", async () => {
    mockGetConsent.mockReturnValue("undecided");
    render(<CookieConsentBanner />);
    expect(await screen.findByRole("region")).toBeInTheDocument();
  });

  it("renders nothing when consent is accepted (EC3)", () => {
    mockGetConsent.mockReturnValue("accepted");
    render(<CookieConsentBanner />);
    expect(screen.queryByRole("region")).toBeNull();
  });

  it("renders nothing when consent is rejected (EC3)", () => {
    mockGetConsent.mockReturnValue("rejected");
    render(<CookieConsentBanner />);
    expect(screen.queryByRole("region")).toBeNull();
  });
});

describe("AC2: banner text and privacy link", () => {
  beforeEach(() => { mockGetConsent.mockReturnValue("undecided"); });

  it("displays the cookie consent message", async () => {
    render(<CookieConsentBanner />);
    expect(await screen.findByText(/We use cookies for ads and visitor counts/)).toBeInTheDocument();
  });

  it("displays Essential cookies are always on", async () => {
    render(<CookieConsentBanner />);
    expect(await screen.findByText(/Essential cookies are always on/)).toBeInTheDocument();
  });

  it("renders a Privacy Policy link to /privacy", async () => {
    render(<CookieConsentBanner />);
    const link = await screen.findByRole("link", { name: /privacy policy/i });
    expect(link).toHaveAttribute("href", "/privacy");
  });
});

describe("AC3: Accept and Reject buttons — equal appearance, side by side", () => {
  beforeEach(() => { mockGetConsent.mockReturnValue("undecided"); });

  it("renders both Accept and Reject buttons", async () => {
    render(<CookieConsentBanner />);
    expect(await screen.findByRole("button", { name: /accept/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reject/i })).toBeInTheDocument();
  });

  it("Accept and Reject share the same className (equal appearance)", async () => {
    render(<CookieConsentBanner />);
    const accept = await screen.findByRole("button", { name: /accept/i });
    const reject = screen.getByRole("button", { name: /reject/i });
    expect(accept.className).toBe(reject.className);
  });
});

describe("AC3: Accept/Reject call setConsent and close the bar", () => {
  beforeEach(() => { mockGetConsent.mockReturnValue("undecided"); });

  it("calls setConsent with accepted on Accept click", async () => {
    render(<CookieConsentBanner />);
    await userEvent.setup().click(await screen.findByRole("button", { name: /accept/i }));
    expect(mockSetConsent).toHaveBeenCalledWith("accepted");
  });

  it("hides the banner after Accept", async () => {
    render(<CookieConsentBanner />);
    await userEvent.setup().click(await screen.findByRole("button", { name: /accept/i }));
    expect(screen.queryByRole("region")).toBeNull();
  });

  it("calls setConsent with rejected on Reject click", async () => {
    render(<CookieConsentBanner />);
    await userEvent.setup().click(await screen.findByRole("button", { name: /reject/i }));
    expect(mockSetConsent).toHaveBeenCalledWith("rejected");
  });

  it("hides the banner after Reject", async () => {
    render(<CookieConsentBanner />);
    await userEvent.setup().click(await screen.findByRole("button", { name: /reject/i }));
    expect(screen.queryByRole("region")).toBeNull();
  });
});

describe("AC4: accessibility attributes", () => {
  it("banner has role=region with an accessible label", async () => {
    mockGetConsent.mockReturnValue("undecided");
    render(<CookieConsentBanner />);
    const region = await screen.findByRole("region");
    expect(region).toHaveAttribute("aria-label");
    expect(region.getAttribute("aria-label")).not.toBe("");
  });
});

describe("AC5: focus moves to main-content after choice", () => {
  let main: HTMLElement;
  beforeEach(() => {
    mockGetConsent.mockReturnValue("undecided");
    main = document.createElement("main");
    main.id = "main-content";
    main.tabIndex = -1;
    document.body.appendChild(main);
  });
  afterEach(() => { main.remove(); });

  it("focuses #main-content after Accept", async () => {
    render(<CookieConsentBanner />);
    await userEvent.setup().click(await screen.findByRole("button", { name: /accept/i }));
    expect(document.activeElement).toBe(main);
  });

  it("focuses #main-content after Reject", async () => {
    render(<CookieConsentBanner />);
    await userEvent.setup().click(await screen.findByRole("button", { name: /reject/i }));
    expect(document.activeElement).toBe(main);
  });
});

describe("AC6: opens from open-cookie-banner event and returns focus to trigger", () => {
  let trigger: HTMLButtonElement;
  beforeEach(() => {
    trigger = document.createElement("button");
    trigger.textContent = "Cookie settings";
    document.body.appendChild(trigger);
  });
  afterEach(() => {
    trigger.remove();
  });
  it("shows the banner when event is dispatched (consent already set)", async () => {
    mockGetConsent.mockReturnValue("accepted");
    render(<CookieConsentBanner />);
    expect(screen.queryByRole("region")).toBeNull();
    await act(async () => {
      window.dispatchEvent(new CustomEvent("open-cookie-banner", { detail: { trigger: null } }));
    });
    expect(await screen.findByRole("region")).toBeInTheDocument();
  });

  it("returns focus to the trigger element after closing", async () => {
    mockGetConsent.mockReturnValue("accepted");
    render(<CookieConsentBanner />);
    await act(async () => {
      window.dispatchEvent(new CustomEvent("open-cookie-banner", { detail: { trigger } }));
    });
    await userEvent.setup().click(await screen.findByRole("button", { name: /accept/i }));
    expect(document.activeElement).toBe(trigger);
  });
});

describe("AC7: scroll padding and body bottom padding", () => {
  it("sets body paddingBottom while banner is visible", async () => {
    mockGetConsent.mockReturnValue("undecided");
    render(<CookieConsentBanner />);
    await screen.findByRole("region");
    expect(document.body.style.paddingBottom).not.toBe("");
  });

  it("clears body paddingBottom after banner is closed", async () => {
    mockGetConsent.mockReturnValue("undecided");
    render(<CookieConsentBanner />);
    await userEvent.setup().click(await screen.findByRole("button", { name: /accept/i }));
    expect(document.body.style.paddingBottom).toBe("");
  });
});

describe("EC1: cookies blocked", () => {
  it("does not crash when setConsent returns ok:false", async () => {
    mockGetConsent.mockReturnValue("undecided");
    mockSetConsent.mockReturnValue({ ok: false });
    render(<CookieConsentBanner />);
    await expect(
      userEvent.setup().click(await screen.findByRole("button", { name: /accept/i }))
    ).resolves.not.toThrow();
  });

  it("closes the banner even when setConsent throws (storage blocked)", async () => {
    mockGetConsent.mockReturnValue("undecided");
    mockSetConsent.mockImplementation(() => { throw new Error("QuotaExceededError"); });
    render(<CookieConsentBanner />);
    await userEvent.setup().click(await screen.findByRole("button", { name: /accept/i }));
    expect(screen.queryByRole("region")).toBeNull();
  });
});

describe("EC4: prior choice shown when banner reopens", () => {
  it("Accept has aria-pressed=true when previous choice was accepted", async () => {
    mockGetConsent.mockReturnValue("accepted");
    render(<CookieConsentBanner />);
    await act(async () => {
      window.dispatchEvent(new CustomEvent("open-cookie-banner", { detail: { trigger: null } }));
    });
    expect(await screen.findByRole("button", { name: /accept/i })).toHaveAttribute("aria-pressed", "true");
  });

  it("Reject has aria-pressed=true when previous choice was rejected", async () => {
    mockGetConsent.mockReturnValue("rejected");
    render(<CookieConsentBanner />);
    await act(async () => {
      window.dispatchEvent(new CustomEvent("open-cookie-banner", { detail: { trigger: null } }));
    });
    expect(await screen.findByRole("button", { name: /reject/i })).toHaveAttribute("aria-pressed", "true");
  });

  it("neither button has aria-pressed=true when consent is undecided", async () => {
    mockGetConsent.mockReturnValue("undecided");
    render(<CookieConsentBanner />);
    expect(await screen.findByRole("button", { name: /accept/i })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: /reject/i })).toHaveAttribute("aria-pressed", "false");
  });
});
