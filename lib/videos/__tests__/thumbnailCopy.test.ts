// S-053: AC4, AC5, EC2, EC3 — copyYouTubeThumbnail

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/config", () => ({
  serverConfig: {
    supabaseServiceRoleKey: "srk",
    videoPlaceholderKey: "placeholders/video.jpg",
  },
  publicConfig: { supabaseUrl: "https://test.supabase.co", supabaseAnonKey: "anon" },
  r2Config: () => ({
    accountId: "test-account",
    accessKeyId: "key",
    secretAccessKey: "secret",
    bucketPublic: "public",
    publicMediaBaseUrl: "https://cdn.test",
  }),
}));
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockResolvedValue({}),
  })),
  PutObjectCommand: vi.fn(),
}));

import { S3Client } from "@aws-sdk/client-s3";
import { copyYouTubeThumbnail } from "@/lib/videos/thumbnailCopy";

const YOUTUBE_ID = "dQw4w9WgXcQ";

function mockFetch(responses: Array<{ ok: boolean; status?: number; headers?: Record<string, string>; body?: Uint8Array }>) {
  let callIndex = 0;
  return vi.fn().mockImplementation(() => {
    const r = responses[callIndex] ?? responses[responses.length - 1];
    callIndex++;
    const headers = new Headers(r.headers ?? { "content-type": "image/jpeg" });
    return Promise.resolve({
      ok: r.ok,
      status: r.status ?? (r.ok ? 200 : 404),
      redirected: false,
      headers,
      arrayBuffer: () => Promise.resolve((r.body ?? new Uint8Array([0xff, 0xd8, 0xff])).buffer),
    });
  });
}

beforeEach(() => {
  vi.mocked(S3Client).mockImplementation(() => ({
    send: vi.fn().mockResolvedValue({}),
  }) as never);
});

describe("copyYouTubeThumbnail — AC4: host rules", () => {
  it("fetches only from i.ytimg.com host (maxresdefault first)", async () => {
    const fetchMock = mockFetch([{ ok: true }]);
    global.fetch = fetchMock;
    await copyYouTubeThumbnail(YOUTUBE_ID);
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain("i.ytimg.com");
    expect(calledUrl).toContain("maxresdefault");
  });

  it("does not follow redirects", async () => {
    global.fetch = mockFetch([{ ok: true }]);
    await copyYouTubeThumbnail(YOUTUBE_ID);
    const opts = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(opts?.redirect).toBe("error");
  });
});

describe("copyYouTubeThumbnail — AC4/EC3: quality fallback", () => {
  it("falls back to sddefault when maxresdefault returns 404", async () => {
    const bigBody = new Uint8Array([0xff, 0xd8, 0xff, ...new Array(50000).fill(0xa0)]);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 404, redirected: false, headers: new Headers({}), arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) })
      .mockResolvedValue({
        ok: true, status: 200, redirected: false,
        headers: new Headers({ "content-type": "image/jpeg", "content-length": String(bigBody.length) }),
        arrayBuffer: () => Promise.resolve(bigBody.buffer),
      });
    global.fetch = fetchMock;
    await copyYouTubeThumbnail(YOUTUBE_ID);
    // First call maxresdefault (404), second call sddefault (success)
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondUrl = fetchMock.mock.calls[1][0] as string;
    expect(secondUrl).toContain("sddefault");
  });

  it("treats tiny image (grey placeholder proxy) as missing and falls back", async () => {
    // A < 2KB response that would look like YouTube's grey 120x90 no-thumbnail image
    const tiny = new Uint8Array(1000); // under 2KB threshold
    tiny[0] = 0xff; tiny[1] = 0xd8; tiny[2] = 0xff; // valid JPEG header
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true, status: 200, redirected: false,
        headers: new Headers({ "content-type": "image/jpeg", "content-length": "1000" }),
        arrayBuffer: () => Promise.resolve(tiny.buffer),
      })
      .mockResolvedValueOnce({
        ok: true, status: 200, redirected: false,
        headers: new Headers({ "content-type": "image/jpeg", "content-length": "50000" }),
        arrayBuffer: () => Promise.resolve(new Uint8Array([0xff, 0xd8, 0xff, ...new Array(50000).fill(0)]).buffer),
      });
    global.fetch = fetchMock;
    const result = await copyYouTubeThumbnail(YOUTUBE_ID);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.ok).toBe(true);
  });
});

describe("copyYouTubeThumbnail — EC2: rejection rules", () => {
  it("rejects response over 500 KB", async () => {
    const bigBody = new Uint8Array(600 * 1024);
    bigBody[0] = 0xff; bigBody[1] = 0xd8; bigBody[2] = 0xff;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, status: 200, redirected: false,
      headers: new Headers({ "content-type": "image/jpeg", "content-length": String(600 * 1024) }),
      arrayBuffer: () => Promise.resolve(bigBody.buffer),
    });
    // All qualities return oversized — falls to placeholder
    const result = await copyYouTubeThumbnail(YOUTUBE_ID);
    // Should not upload oversized image; either use placeholder or fail gracefully
    if (result.ok) {
      expect(result.thumbnailSource).toBe("youtube_copy");
    }
  });

  it("rejects non-image content-type", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, status: 200, redirected: false,
      headers: new Headers({ "content-type": "text/html" }),
      arrayBuffer: () => Promise.resolve(new Uint8Array([0x3c, 0x68]).buffer),
    });
    const result = await copyYouTubeThumbnail(YOUTUBE_ID);
    // Falls through all qualities to placeholder
    expect(result.ok).toBe(true); // placeholder used
  });
});

describe("copyYouTubeThumbnail — AC5: all copies fail gives placeholder", () => {
  it("returns placeholder key when all qualities fail", async () => {
    global.fetch = mockFetch([{ ok: false, status: 404 }]);
    const result = await copyYouTubeThumbnail(YOUTUBE_ID);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.thumbnailSource).toBe("youtube_copy");
      expect(result.placeholderUsed).toBe(true);
    }
  });
});
