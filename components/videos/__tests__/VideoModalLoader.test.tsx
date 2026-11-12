import { render, screen, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockReplace = vi.fn();
let mockVideoId: string | null = null;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => ({
    get: (key: string) => (key === "video" ? mockVideoId : null),
  }),
}));

vi.mock("@/lib/feed/query", () => ({
  getPublishedVideo: vi.fn().mockResolvedValue({
    ok: true,
    video: {
      id: "abc123",
      youtubeId: "dQw4w9WgXcQ",
      title: "Safety Video",
      description: null,
      thumbnailKey: "thumb.jpg",
      categoryId: "cat-1",
    },
  }),
}));

import { VideoModalLoader } from "../VideoModalLoader";

beforeEach(() => {
  vi.clearAllMocks();
  mockVideoId = null;
});

describe("VideoModalLoader", () => {
  it("AC8: direct visit with ?video=<id> shows the modal", async () => {
    mockVideoId = "abc123";
    render(<VideoModalLoader />);
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
  });

  it("renders nothing when no video param is set", () => {
    mockVideoId = null;
    const { container } = render(<VideoModalLoader />);
    expect(container.firstChild).toBeNull();
  });

  it("AC2: injects noindex meta tag while video is open", async () => {
    mockVideoId = "abc123";
    render(<VideoModalLoader />);
    await waitFor(() => {
      expect(document.head.querySelector('meta[name="robots"]')).not.toBeNull();
    });
    const meta = document.head.querySelector('meta[data-video-popup="1"]') as HTMLMetaElement;
    expect(meta?.content).toBe("noindex");
  });
});
