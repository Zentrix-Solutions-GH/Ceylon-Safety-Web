import { render, act } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("@/lib/consent", () => ({
  getConsent: vi.fn(),
}));

import { AdUnit } from "../AdUnit";
import { getConsent } from "@/lib/consent";

const mockGetConsent = vi.mocked(getConsent);

afterEach(() => { vi.clearAllMocks(); });

describe("AdUnit consent gate", () => {
  it("renders nothing when consent is undecided", () => {
    mockGetConsent.mockReturnValue("undecided");
    render(<AdUnit clientId="ca-pub-123" slot="456" />);
    expect(document.querySelector("ins.adsbygoogle")).toBeNull();
  });

  it("renders nothing when consent is rejected", () => {
    mockGetConsent.mockReturnValue("rejected");
    render(<AdUnit clientId="ca-pub-123" slot="456" />);
    expect(document.querySelector("ins.adsbygoogle")).toBeNull();
  });

  it("renders the ins element after consent is accepted", async () => {
    mockGetConsent.mockReturnValue("accepted");
    await act(async () => {
      render(<AdUnit clientId="ca-pub-123" slot="456" />);
    });
    const ins = document.querySelector("ins.adsbygoogle") as HTMLElement | null;
    expect(ins).not.toBeNull();
    expect(ins?.getAttribute("data-ad-client")).toBe("ca-pub-123");
    expect(ins?.getAttribute("data-ad-slot")).toBe("456");
  });

  it("does not push to adsbygoogle when consent is not accepted", () => {
    mockGetConsent.mockReturnValue("undecided");
    const push = vi.fn();
    Object.defineProperty(window, "adsbygoogle", { value: { push }, writable: true, configurable: true });
    render(<AdUnit clientId="ca-pub-123" slot="456" />);
    expect(push).not.toHaveBeenCalled();
  });

  it("pushes to adsbygoogle only when consent is accepted", async () => {
    mockGetConsent.mockReturnValue("accepted");
    const push = vi.fn();
    (window as unknown as Record<string, unknown>).adsbygoogle = { push };
    await act(async () => {
      render(<AdUnit clientId="ca-pub-123" slot="456" />);
    });
    expect(push).toHaveBeenCalledWith({});
  });
});
