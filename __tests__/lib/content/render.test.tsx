// S-056: lib/content/render — AC4 (video block → thumbnail card), AC5 (hidden/deleted → empty)

import { render } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SCHEMA_VERSION } from "@/lib/content/schema";

vi.mock("@/lib/config.public", () => ({
  publicConfig: {
    appUrl: "https://ceylonsafety.com",
    mediaCdnUrl: "https://cdn.test",
  },
}));

import { renderArticleBody } from "@/lib/content/render";

function makeVideoBody(
  videoId: string,
  extra?: { title?: string; thumbnailKey?: string },
) {
  return {
    schema_version: SCHEMA_VERSION,
    type: "doc" as const,
    content: [
      {
        type: "video" as const,
        attrs: { node_id: "node-1", video_id: videoId, ...extra },
      },
    ],
  };
}

describe("renderArticleBody — AC4: video block renders thumbnail card", () => {
  it("renders a link to /?video=<videoId> with thumbnail and title", () => {
    const body = makeVideoBody("vid-123", {
      title: "Fire Safety",
      thumbnailKey: "videos/vid-123/thumb.jpg",
    });
    const { container } = render(renderArticleBody(body));

    const link = container.querySelector("a[data-block='video']");
    expect(link).toHaveAttribute("href", "/?video=vid-123");
    const img = link?.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toBe("https://cdn.test/videos/vid-123/thumb.jpg");
    expect(img?.getAttribute("alt")).toBe("Fire Safety");
    expect(link?.textContent).toContain("Fire Safety");
  });

  it("renders link without thumbnail when thumbnailKey absent", () => {
    const body = makeVideoBody("vid-456");
    const { container } = render(renderArticleBody(body));
    const link = container.querySelector("a[data-block='video']");
    expect(link).toHaveAttribute("href", "/?video=vid-456");
    expect(link?.querySelector("img")).toBeNull();
  });
});

describe("renderArticleBody — AC5: hidden/deleted video block renders nothing", () => {
  it("renders nothing when video_id is empty", () => {
    const body = makeVideoBody("");
    const { container } = render(renderArticleBody(body));
    expect(container.querySelectorAll("a")).toHaveLength(0);
  });

  it("renders nothing when resolvedVideos marks video as hidden", () => {
    const body = makeVideoBody("vid-123", {
      title: "Fire Safety",
      thumbnailKey: "videos/vid-123/thumb.jpg",
    });
    const { container } = render(
      renderArticleBody(body, [{ nodeId: "node-1", videoId: "vid-123", status: "hidden" }]),
    );
    expect(container.querySelectorAll("a[data-block='video']")).toHaveLength(0);
  });

  it("renders nothing when resolvedVideos marks video as deleted", () => {
    const body = makeVideoBody("vid-123");
    const { container } = render(
      renderArticleBody(body, [{ nodeId: "node-1", videoId: "vid-123", status: "deleted" }]),
    );
    expect(container.querySelectorAll("a[data-block='video']")).toHaveLength(0);
  });
});
