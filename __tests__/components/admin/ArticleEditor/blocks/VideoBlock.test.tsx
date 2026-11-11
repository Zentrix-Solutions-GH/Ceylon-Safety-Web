// S-056: VideoBlock component — AC2 (thumbnail+title), AC5 (hidden/deleted warning)

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/config.public", () => ({
  publicConfig: { mediaCdnUrl: "https://cdn.test" },
}));

import VideoBlock from "@/components/admin/ArticleEditor/blocks/VideoBlock";

describe("VideoBlock — AC2: renders thumbnail and title", () => {
  it("shows thumbnail image with title as alt text", () => {
    render(
      <VideoBlock
        videoId="vid-123"
        title="PPE Safety Guide"
        thumbnailKey="videos/vid-123/thumb.jpg"
        status="ready"
        onRemove={vi.fn()}
      />
    );
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "https://cdn.test/videos/vid-123/thumb.jpg");
    expect(img).toHaveAttribute("alt", "PPE Safety Guide");
    expect(screen.getByText("PPE Safety Guide")).toBeInTheDocument();
  });

  it("renders remove button", () => {
    const onRemove = vi.fn();
    render(
      <VideoBlock
        videoId="vid-123"
        title="Test Video"
        thumbnailKey="videos/vid-123/thumb.jpg"
        status="ready"
        onRemove={onRemove}
      />
    );
    const btn = screen.getByRole("button", { name: /remove/i });
    fireEvent.click(btn);
    expect(onRemove).toHaveBeenCalled();
  });
});

describe("VideoBlock — AC5: warning for hidden or deleted video", () => {
  it("shows warning banner when status is hidden", () => {
    render(
      <VideoBlock
        videoId="vid-123"
        title="Hidden Video"
        thumbnailKey="videos/vid-123/thumb.jpg"
        status="hidden"
        onRemove={vi.fn()}
      />
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/hidden or deleted/i)).toBeInTheDocument();
  });

  it("renders nothing (null) when status is deleted", () => {
    const { container } = render(
      <VideoBlock
        videoId="vid-123"
        title="Deleted Video"
        thumbnailKey="videos/vid-123/thumb.jpg"
        status="deleted"
        onRemove={vi.fn()}
      />
    );
    // For deleted status, component returns null — container should be empty
    expect(container.firstChild).toBeNull();
  });
});
