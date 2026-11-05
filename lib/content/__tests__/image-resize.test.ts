// S-047: image-resize browser helper — AC11, EC5, EC6
// Canvas API is mocked since tests run in Node (no real browser).

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock browser canvas
const mockToBlob = vi.fn();
const mockGetContext = vi.fn();
const mockDrawImage = vi.fn();
const mockCanvas = {
  width: 0,
  height: 0,
  getContext: mockGetContext,
  toBlob: mockToBlob,
};
const mockCtx = { drawImage: mockDrawImage };

// Mock createImageBitmap and document.createElement
vi.stubGlobal("createImageBitmap", vi.fn());
vi.stubGlobal("document", {
  createElement: vi.fn().mockReturnValue(mockCanvas),
});

import { resizeImage } from "@/lib/content/image-resize";

function makeFile(name: string, type: string, size: number): File {
  const buf = new Uint8Array(size);
  return new File([buf], name, { type });
}

function makeBlob(type: string, size: number): Blob {
  return new Blob([new Uint8Array(size)], { type });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetContext.mockReturnValue(mockCtx);
  // Default: canvas.toBlob calls callback with a WebP blob
  mockToBlob.mockImplementation((cb: (b: Blob | null) => void, type: string) => {
    cb(makeBlob(type ?? "image/webp", 50 * 1024));
  });
});

describe("resizeImage", () => {
  it("AC11: refuses a file with a non-JPEG/PNG/WebP type", async () => {
    vi.mocked(createImageBitmap).mockResolvedValue({
      width: 1000, height: 800, close: vi.fn(),
    } as unknown as ImageBitmap);

    const file = makeFile("img.gif", "image/gif", 1024);
    await expect(resizeImage(file)).rejects.toThrow();
  });

  it("AC11: refuses a file over 5 MB", async () => {
    const file = makeFile("img.jpg", "image/jpeg", 6 * 1024 * 1024);
    await expect(resizeImage(file)).rejects.toThrow();
  });

  it("EC6: refuses an image wider or taller than 6000 px", async () => {
    vi.mocked(createImageBitmap).mockResolvedValue({
      width: 7000, height: 400, close: vi.fn(),
    } as unknown as ImageBitmap);
    const file = makeFile("big.jpg", "image/jpeg", 1024);
    await expect(resizeImage(file)).rejects.toThrow();
  });

  it("AC11: returns two WebP copies at 480 and 1200 for a wide image", async () => {
    vi.mocked(createImageBitmap).mockResolvedValue({
      width: 2000, height: 1333, close: vi.fn(),
    } as unknown as ImageBitmap);
    const file = makeFile("img.jpg", "image/jpeg", 1024);

    const result = await resizeImage(file);

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.width)).toContain(480);
    expect(result.map((r) => r.width)).toContain(1200);
  });

  it("AC11: image narrower than 480 px gets only one copy", async () => {
    vi.mocked(createImageBitmap).mockResolvedValue({
      width: 300, height: 200, close: vi.fn(),
    } as unknown as ImageBitmap);
    const file = makeFile("small.jpg", "image/jpeg", 1024);

    const result = await resizeImage(file);

    expect(result).toHaveLength(1);
    expect(result[0]!.width).toBe(300); // at original width
  });

  it("AC11: never returns the full-size original", async () => {
    vi.mocked(createImageBitmap).mockResolvedValue({
      width: 2000, height: 1333, close: vi.fn(),
    } as unknown as ImageBitmap);
    const file = makeFile("img.jpg", "image/jpeg", 1024);

    const result = await resizeImage(file);

    expect(result.every((r) => r.width < 2000)).toBe(true);
  });

  it("EC5: browser returns JPEG instead of WebP (canvas fallback)", async () => {
    vi.mocked(createImageBitmap).mockResolvedValue({
      width: 1500, height: 1000, close: vi.fn(),
    } as unknown as ImageBitmap);
    // canvas.toBlob returns JPEG (older browser fallback)
    mockToBlob.mockImplementation((cb: (b: Blob | null) => void) => {
      cb(makeBlob("image/jpeg", 40 * 1024));
    });

    const file = makeFile("img.png", "image/png", 1024);
    const result = await resizeImage(file);

    // Should still succeed — JPEG is an allowed fallback
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((r) => r.blob.type === "image/jpeg" || r.blob.type === "image/webp")).toBe(true);
  });
});
