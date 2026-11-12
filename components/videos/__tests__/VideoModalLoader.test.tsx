import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockReplace = vi.fn();
let mockVideoId: string | null = null;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => ({
    get: (key: string) => (key === "video" ? mockVideoId : null),
  }),
}));

const SAMPLE_VIDEO = {
  id: "abc123",
  youtubeId: "dQw4w9WgXcQ",
  title: "Safety Video",
  description: null,
  thumbnailKey: "thumb.jpg",
  categoryId: "cat-1",
};

function mockFetchOk() {
  global.fetch = vi.fn().mockResolvedValue({
    json: () => Promise.resolve({ ok: true, video: SAMPLE_VIDEO }),
  } as unknown as Response);
}

import { VideoModalLoader } from "../VideoModalLoader";

beforeEach(() => {
  vi.clearAllMocks();
  mockVideoId = null;
  mockFetchOk();
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

  it("AC2: removes noindex meta tag after modal closes", async () => {
    mockVideoId = "abc123";
    const { rerender } = render(<VideoModalLoader />);
    await waitFor(() => {
      expect(document.head.querySelector('meta[data-video-popup="1"]')).not.toBeNull();
    });
    // Simulate URL param being removed (modal closed)
    mockVideoId = null;
    rerender(<VideoModalLoader />);
    await waitFor(() => {
      expect(document.head.querySelector('meta[data-video-popup="1"]')).toBeNull();
    });
  });

  it("AC7: close button calls router.replace removing ?video= param", async () => {
    mockVideoId = "abc123";
    // Set a base URL for the test
    Object.defineProperty(window, "location", {
      value: { href: "http://localhost/?video=abc123" },
      writable: true,
    });
    render(<VideoModalLoader />);
    await waitFor(() => screen.getByRole("dialog"));
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/", { scroll: false });
    });
  });

  it("AC6: close returns focus to the trigger element", async () => {
    mockVideoId = "abc123";
    // Create a fake trigger and make it the active element
    const trigger = document.createElement("button");
    trigger.textContent = "Open video";
    document.body.appendChild(trigger);
    trigger.focus();

    Object.defineProperty(window, "location", {
      value: { href: "http://localhost/?video=abc123" },
      writable: true,
    });

    render(<VideoModalLoader />);
    await waitFor(() => screen.getByRole("dialog"));

    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    // requestAnimationFrame in jsdom runs synchronously with fake timers; flush it
    await waitFor(() => {
      expect(document.activeElement).toBe(trigger);
    });

    document.body.removeChild(trigger);
  });
});
