// S-056: ItemPickerModal — AC1 (opens with video list), AC3 (empty state), EC1 (real-time filter)

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/config.public", () => ({
  publicConfig: { mediaCdnUrl: "https://cdn.test" },
}));

const mockListPickerItems = vi.fn();
vi.mock("@/lib/videos/actions/listPickerItemsAction", () => ({
  listPickerItemsAction: (...args: unknown[]) => mockListPickerItems(...args),
}));

import ItemPickerModal from "@/components/admin/ArticleEditor/ItemPickerModal";

const VIDEO_A = { id: "vid-1", title: "Safety Helmet Guide", thumbnailKey: "videos/vid-1/thumb.jpg", kind: "video" as const };
const VIDEO_B = { id: "vid-2", title: "Fire Extinguisher Types", thumbnailKey: "videos/vid-2/thumb.jpg", kind: "video" as const };

beforeEach(() => {
  mockListPickerItems.mockReset();
});

describe("ItemPickerModal — AC1: shows published videos", () => {
  it("renders list of published videos with thumbnails and titles", async () => {
    mockListPickerItems.mockResolvedValue({ ok: true, items: [VIDEO_A, VIDEO_B], hasMore: false });
    render(<ItemPickerModal onPick={vi.fn()} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Safety Helmet Guide")).toBeInTheDocument();
      expect(screen.getByText("Fire Extinguisher Types")).toBeInTheDocument();
    });

    const imgs = screen.getAllByRole("img");
    expect(imgs[0]).toHaveAttribute("src", "https://cdn.test/videos/vid-1/thumb.jpg");
  });

  it("calls onPick with video id and title when video is selected", async () => {
    mockListPickerItems.mockResolvedValue({ ok: true, items: [VIDEO_A], hasMore: false });
    const onPick = vi.fn();
    render(<ItemPickerModal onPick={onPick} onClose={vi.fn()} />);

    await waitFor(() => screen.getByText("Safety Helmet Guide"));
    fireEvent.click(screen.getByText("Safety Helmet Guide"));

    expect(onPick).toHaveBeenCalledWith({
      id: "vid-1",
      title: "Safety Helmet Guide",
      thumbnailKey: "videos/vid-1/thumb.jpg",
    });
  });
});

describe("ItemPickerModal — AC3: empty state when no published videos", () => {
  it("shows empty state message with link to /admin/videos", async () => {
    mockListPickerItems.mockResolvedValue({ ok: true, items: [], hasMore: false });
    render(<ItemPickerModal onPick={vi.fn()} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/no published videos/i)).toBeInTheDocument();
    });

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/admin/videos");
  });
});

describe("ItemPickerModal — P1: error state on server failure", () => {
  it("shows error message (not empty-state) when listPickerItemsAction returns ok: false", async () => {
    mockListPickerItems.mockResolvedValue({ ok: false, code: "not_allowed" });
    render(<ItemPickerModal onPick={vi.fn()} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expect(screen.queryByText(/no published videos/i)).toBeNull();
  });
});

describe("ItemPickerModal — EC1: real-time title filter", () => {
  it("calls listPickerItems with search text when user types", async () => {
    mockListPickerItems.mockResolvedValue({ ok: true, items: [VIDEO_A], hasMore: false });
    render(<ItemPickerModal onPick={vi.fn()} onClose={vi.fn()} />);

    await waitFor(() => screen.getByRole("searchbox"));
    const input = screen.getByRole("searchbox");
    fireEvent.change(input, { target: { value: "Safety" } });

    await waitFor(() => {
      expect(mockListPickerItems).toHaveBeenCalledWith(
        expect.objectContaining({ search: "Safety" })
      );
    });
  });
});
