import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PublicVideo } from "@/types/video";

// Mock next/navigation
const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// Mock getPublishedVideo
vi.mock("@/lib/feed/query", () => ({
  getPublishedVideo: vi.fn(),
}));

import { VideoModal } from "../VideoModal";
import { getPublishedVideo } from "@/lib/feed/query";

const mockGetPublishedVideo = vi.mocked(getPublishedVideo);

const SAMPLE_VIDEO: PublicVideo = {
  id: "abc123",
  youtubeId: "dQw4w9WgXcQ",
  title: "Test Safety Video",
  description: null,
  thumbnailKey: "videos/thumb.jpg",
  categoryId: "cat-1",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetPublishedVideo.mockResolvedValue({ ok: true, video: SAMPLE_VIDEO });
});

describe("VideoModal", () => {
  it("AC5: shows not-available notice for unknown video id", async () => {
    mockGetPublishedVideo.mockResolvedValue({ ok: false, code: "not_found" });
    render(<VideoModal videoId="unknown-id" onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText(/this video is not available/i)).toBeInTheDocument();
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("AC5, EC2: script injection in video id shows not-available", async () => {
    mockGetPublishedVideo.mockResolvedValue({ ok: false, code: "not_found" });
    render(<VideoModal videoId="<script>alert(1)</script>" onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText(/this video is not available/i)).toBeInTheDocument();
    });
  });

  it("AC5, EC2: extremely long id shows not-available", async () => {
    mockGetPublishedVideo.mockResolvedValue({ ok: false, code: "not_found" });
    render(<VideoModal videoId={"x".repeat(500)} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText(/this video is not available/i)).toBeInTheDocument();
    });
  });

  it("AC1: opens dialog with video title for a valid video", async () => {
    render(<VideoModal videoId="abc123" onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText(SAMPLE_VIDEO.title)).toBeInTheDocument();
    });
  });

  it("AC6, AC7: Escape closes the modal and calls onClose", async () => {
    const onClose = vi.fn();
    render(<VideoModal videoId="abc123" onClose={onClose} />);
    await waitFor(() => screen.getByRole("dialog"));
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("AC6, AC7: close button calls onClose", async () => {
    const onClose = vi.fn();
    render(<VideoModal videoId="abc123" onClose={onClose} />);
    await waitFor(() => screen.getByRole("dialog"));
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("network error from getPublishedVideo shows unavailable notice", async () => {
    mockGetPublishedVideo.mockRejectedValue(new Error("network error"));
    render(<VideoModal videoId="abc123" onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText(/this video is not available/i)).toBeInTheDocument();
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("AC9: shows title only — no like or comment controls", async () => {
    render(<VideoModal videoId="abc123" onClose={vi.fn()} />);
    await waitFor(() => screen.getByRole("dialog"));
    expect(screen.queryByText(/like/i)).toBeNull();
    expect(screen.queryByText(/comment/i)).toBeNull();
  });
});
