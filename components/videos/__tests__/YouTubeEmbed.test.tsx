import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { YouTubeEmbed } from "../YouTubeEmbed";

const VALID_ID = "dQw4w9WgXcQ";
const THUMBNAIL = "https://cdn.test.example.com/thumb.jpg";
const TITLE = "Test Video";

describe("YouTubeEmbed", () => {
  it("AC3: shows thumbnail and play button before play is pressed", () => {
    render(<YouTubeEmbed youtubeId={VALID_ID} thumbnailUrl={THUMBNAIL} title={TITLE} />);
    expect(screen.getByRole("img", { name: TITLE })).toBeInTheDocument();
    expect(screen.queryByTitle(/youtube/i)).toBeNull();
  });

  it("AC3: shows 'This loads YouTube' notice before play", () => {
    render(<YouTubeEmbed youtubeId={VALID_ID} thumbnailUrl={THUMBNAIL} title={TITLE} />);
    expect(screen.getByText(/this loads youtube/i)).toBeInTheDocument();
  });

  it("AC3, AC4: creates iframe only after play is clicked", () => {
    render(<YouTubeEmbed youtubeId={VALID_ID} thumbnailUrl={THUMBNAIL} title={TITLE} />);
    expect(screen.queryByTitle(/youtube/i)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /play/i }));
    const iframe = screen.getByTitle(/youtube player/i) as HTMLIFrameElement;
    expect(iframe).toBeInTheDocument();
  });

  it("AC4: iframe src uses www.youtube-nocookie.com", () => {
    render(<YouTubeEmbed youtubeId={VALID_ID} thumbnailUrl={THUMBNAIL} title={TITLE} />);
    fireEvent.click(screen.getByRole("button", { name: /play/i }));
    const iframe = screen.getByTitle(/youtube player/i) as HTMLIFrameElement;
    expect(iframe.src).toContain("www.youtube-nocookie.com");
    expect(iframe.src).toContain(VALID_ID);
  });

  it("AC4: bad YouTube id — no iframe created", () => {
    render(<YouTubeEmbed youtubeId="bad id!" thumbnailUrl={THUMBNAIL} title={TITLE} />);
    const btn = screen.queryByRole("button", { name: /play/i });
    if (btn) fireEvent.click(btn);
    expect(screen.queryByTitle(/youtube player/i)).toBeNull();
  });

  it("AC4: short id (10 chars) — no iframe", () => {
    render(<YouTubeEmbed youtubeId="short123ab" thumbnailUrl={THUMBNAIL} title={TITLE} />);
    const btn = screen.queryByRole("button", { name: /play/i });
    if (btn) fireEvent.click(btn);
    expect(screen.queryByTitle(/youtube player/i)).toBeNull();
  });

  it("EC5: missing thumbnail falls back to placeholder", () => {
    render(<YouTubeEmbed youtubeId={VALID_ID} thumbnailUrl={undefined} title={TITLE} />);
    const img = screen.getByRole("img", { name: TITLE }) as HTMLImageElement;
    expect(img.src).toContain("video-placeholder");
  });
});
