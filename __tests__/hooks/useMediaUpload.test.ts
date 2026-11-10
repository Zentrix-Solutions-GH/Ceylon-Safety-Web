// S-055: useMediaUpload hook — AC1 presign→PUT→confirm order, EC3 network failure, rate_limited, AC7 upload_failed

import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ResizedVariant } from "@/lib/content/image-resize";
import type { GetImageUploadLinkResult, ConfirmImageUploadResult } from "@/types/media";

vi.mock("@/lib/media/actions/getImageUploadLink", () => ({
  getImageUploadLink: vi.fn(),
}));
vi.mock("@/lib/media/actions/confirmImageUpload", () => ({
  confirmImageUpload: vi.fn(),
}));

import { getImageUploadLink } from "@/lib/media/actions/getImageUploadLink";
import { confirmImageUpload } from "@/lib/media/actions/confirmImageUpload";
import { useMediaUpload } from "@/hooks/useMediaUpload";

const mockGetLink = getImageUploadLink as ReturnType<typeof vi.fn>;
const mockConfirm = confirmImageUpload as ReturnType<typeof vi.fn>;

const fakeVariant = (width: number): ResizedVariant => ({
  blob: new Blob(["x"], { type: "image/webp" }),
  width,
  height: Math.round(width * 0.5625),
  mimeType: "image/webp",
});

describe("useMediaUpload — AC1: presign → PUT → confirm in order", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls getImageUploadLink, then PUT, then confirmImageUpload in sequence", async () => {
    const callOrder: string[] = [];

    mockGetLink.mockImplementation(async () => {
      callOrder.push("presign");
      return {
        ok: true,
        mediaId: "media-123",
        links: [
          { width: 480, url: "https://r2.example.com/put-480", mimeType: "image/webp" },
          { width: 1200, url: "https://r2.example.com/put-1200", mimeType: "image/webp" },
        ],
      } satisfies GetImageUploadLinkResult;
    });

    const mockFetch = vi.fn().mockImplementation(async () => {
      callOrder.push("put");
      return new Response(null, { status: 200 });
    });
    vi.stubGlobal("fetch", mockFetch);

    mockConfirm.mockImplementation(async () => {
      callOrder.push("confirm");
      return { ok: true, mediaId: "media-123" } satisfies ConfirmImageUploadResult;
    });

    const onSuccess = vi.fn();
    const { result } = renderHook(() => useMediaUpload({ onSuccess }));

    await act(async () => {
      await result.current.upload([fakeVariant(480), fakeVariant(1200)], "image/webp");
    });

    expect(callOrder).toEqual(["presign", "put", "put", "confirm"]);
    expect(onSuccess).toHaveBeenCalledWith("media-123");
  });
});

describe("useMediaUpload — EC3: network failure during R2 PUT", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sets status to error and does not call confirm on PUT failure", async () => {
    mockGetLink.mockResolvedValue({
      ok: true,
      mediaId: "media-456",
      links: [{ width: 480, url: "https://r2.example.com/put-480", mimeType: "image/webp" }],
    } satisfies GetImageUploadLinkResult);

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Network error")));

    const onError = vi.fn();
    const { result } = renderHook(() => useMediaUpload({ onError }));

    await act(async () => {
      await result.current.upload([fakeVariant(480)], "image/webp");
    });

    expect(result.current.status).toBe("error");
    expect(mockConfirm).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalled();
  });

  it("exposes retry that re-attempts from presign with same mediaId", async () => {
    mockGetLink.mockResolvedValue({
      ok: true,
      mediaId: "media-456",
      links: [{ width: 480, url: "https://r2.example.com/put-480", mimeType: "image/webp" }],
    } satisfies GetImageUploadLinkResult);

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Network error")));

    const { result } = renderHook(() => useMediaUpload({}));

    await act(async () => {
      await result.current.upload([fakeVariant(480)], "image/webp");
    });

    expect(result.current.status).toBe("error");

    // Now fix fetch and retry
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 200 })));
    mockConfirm.mockResolvedValue({ ok: true, mediaId: "media-456" } satisfies ConfirmImageUploadResult);

    await act(async () => {
      await result.current.retry();
    });

    expect(result.current.status).toBe("ready");
    // retry should pass existing mediaId
    expect(mockGetLink).toHaveBeenLastCalledWith(expect.objectContaining({ mediaId: "media-456" }));
  });
});

describe("useMediaUpload — rate_limited", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sets status to error with rate_limited code when server returns rate_limited", async () => {
    mockGetLink.mockResolvedValue({
      ok: false,
      code: "rate_limited",
    } satisfies GetImageUploadLinkResult);

    const onError = vi.fn();
    const { result } = renderHook(() => useMediaUpload({ onError }));

    await act(async () => {
      await result.current.upload([fakeVariant(480)], "image/webp");
    });

    expect(result.current.status).toBe("error");
    expect(result.current.errorCode).toBe("rate_limited");
    expect(onError).toHaveBeenCalled();
  });
});

describe("useMediaUpload — AC7: confirm upload_failed", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sets status to upload_failed and calls onUploadFailed when confirm returns upload_failed", async () => {
    mockGetLink.mockResolvedValue({
      ok: true,
      mediaId: "media-789",
      links: [{ width: 480, url: "https://r2.example.com/put-480", mimeType: "image/webp" }],
    } satisfies GetImageUploadLinkResult);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 200 })));

    mockConfirm.mockResolvedValue({
      ok: false,
      code: "upload_failed",
    } satisfies ConfirmImageUploadResult);

    const onUploadFailed = vi.fn();
    const { result } = renderHook(() => useMediaUpload({ onUploadFailed }));

    await act(async () => {
      await result.current.upload([fakeVariant(480)], "image/webp");
    });

    expect(result.current.status).toBe("upload_failed");
    expect(onUploadFailed).toHaveBeenCalled();
  });
});
