import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/settings/ads", () => ({
  getAdsSettings: vi.fn(),
}));

// Stub AdUnit so tests don't need a consent cookie
vi.mock("@/components/ads/AdUnit", () => ({
  AdUnit: ({ slot }: { slot: string }) => <div data-testid="ad-unit" data-slot={slot} />,
}));

import { SideAdColumn } from "../SideAdColumn";
import { getAdsSettings } from "@/lib/settings/ads";

const mockGetAdsSettings = vi.mocked(getAdsSettings);

const noAds = { enabled: false, clientId: "", slotSidebarLeft: "", slotSidebarRight: "" };
const withAds = { enabled: true, clientId: "ca-pub-1", slotSidebarLeft: "s-left", slotSidebarRight: "s-right" };

// NODE_ENV is "test" in vitest — isDev is false, so the production branches run.
describe("SideAdColumn — production branches (NODE_ENV=test)", () => {
  it("returns null when ads disabled", async () => {
    mockGetAdsSettings.mockResolvedValue(noAds);
    const ui = await SideAdColumn({ side: "left" });
    const { container } = render(ui as React.ReactElement);
    expect(container.firstChild).toBeNull();
  });

  it("returns null when clientId is missing", async () => {
    mockGetAdsSettings.mockResolvedValue({ ...withAds, clientId: "" });
    const ui = await SideAdColumn({ side: "left" });
    const { container } = render(ui as React.ReactElement);
    expect(container.firstChild).toBeNull();
  });

  it("returns null when left slot is empty", async () => {
    mockGetAdsSettings.mockResolvedValue({ ...withAds, slotSidebarLeft: "" });
    const ui = await SideAdColumn({ side: "left" });
    const { container } = render(ui as React.ReactElement);
    expect(container.firstChild).toBeNull();
  });

  it("returns null when right slot is empty", async () => {
    mockGetAdsSettings.mockResolvedValue({ ...withAds, slotSidebarRight: "" });
    const ui = await SideAdColumn({ side: "right" });
    const { container } = render(ui as React.ReactElement);
    expect(container.firstChild).toBeNull();
  });

  it("renders AdUnit with the left slot", async () => {
    mockGetAdsSettings.mockResolvedValue(withAds);
    const ui = await SideAdColumn({ side: "left" });
    render(ui as React.ReactElement);
    expect(screen.getByTestId("ad-unit")).toHaveAttribute("data-slot", "s-left");
  });

  it("renders AdUnit with the right slot", async () => {
    mockGetAdsSettings.mockResolvedValue(withAds);
    const ui = await SideAdColumn({ side: "right" });
    render(ui as React.ReactElement);
    expect(screen.getByTestId("ad-unit")).toHaveAttribute("data-slot", "s-right");
  });
});
