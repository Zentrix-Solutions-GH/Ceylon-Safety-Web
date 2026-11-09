import { describe, it, expect } from "vitest";
import { extractYouTubeId, YOUTUBE_ID_RE } from "../youtube";

describe("extractYouTubeId — AC1 / EC1", () => {
  // Valid link shapes
  it("parses watch link", () => {
    expect(extractYouTubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("parses youtu.be short link", () => {
    expect(extractYouTubeId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("parses embed link", () => {
    expect(extractYouTubeId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("parses shorts link", () => {
    expect(extractYouTubeId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("accepts m.youtube.com host", () => {
    expect(extractYouTubeId("https://m.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("accepts youtube.com (no www) host", () => {
    expect(extractYouTubeId("https://youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("accepts id with underscore and hyphen", () => {
    expect(extractYouTubeId("https://youtu.be/abc_DEF-123")).toBe("abc_DEF-123");
  });

  it("strips extra query params from watch link", () => {
    expect(extractYouTubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLxxx")).toBe("dQw4w9WgXcQ");
  });

  it("strips timestamp from youtu.be", () => {
    expect(extractYouTubeId("https://youtu.be/dQw4w9WgXcQ?t=42")).toBe("dQw4w9WgXcQ");
  });

  // EC1: rejected hosts and malformed links
  it("rejects non-youtube host", () => {
    expect(extractYouTubeId("https://vimeo.com/dQw4w9WgXcQ")).toBeNull();
  });

  it("rejects link with username path", () => {
    expect(extractYouTubeId("https://www.youtube.com/@channelname/videos")).toBeNull();
  });

  it("rejects link with control character in host", () => {
    expect(extractYouTubeId("https://www.youtube.com\x00evil/watch?v=abc1234567A")).toBeNull();
  });

  it("rejects id shorter than 11 chars", () => {
    expect(extractYouTubeId("https://youtu.be/short")).toBeNull();
  });

  it("rejects id longer than 11 chars", () => {
    expect(extractYouTubeId("https://youtu.be/toolongid123")).toBeNull();
  });

  it("rejects id with question mark", () => {
    expect(extractYouTubeId("https://youtu.be/abc?def12345")).toBeNull();
  });

  it("rejects id with slash", () => {
    expect(extractYouTubeId("https://youtu.be/abc/def12345")).toBeNull();
  });

  it("rejects id with ampersand", () => {
    expect(extractYouTubeId("https://youtu.be/abc&def12345")).toBeNull();
  });

  it("rejects id with less-than sign", () => {
    expect(extractYouTubeId("https://youtu.be/abc<def12345")).toBeNull();
  });

  it("rejects bare string (no URL)", () => {
    expect(extractYouTubeId("dQw4w9WgXcQ")).toBeNull();
  });

  it("rejects empty string", () => {
    expect(extractYouTubeId("")).toBeNull();
  });

  // YOUTUBE_ID_RE is used in DB CHECK — test it matches the same set
  it("YOUTUBE_ID_RE accepts valid id", () => {
    expect(YOUTUBE_ID_RE.test("dQw4w9WgXcQ")).toBe(true);
  });

  it("YOUTUBE_ID_RE rejects 10-char id", () => {
    expect(YOUTUBE_ID_RE.test("dQw4w9WgXc")).toBe(false);
  });

  it("YOUTUBE_ID_RE rejects id with special char", () => {
    expect(YOUTUBE_ID_RE.test("dQw4w9WgX?Q")).toBe(false);
  });
});
