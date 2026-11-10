// S-055: ImageUploadField — AC4 alt-required guard

import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/content/image-resize", () => ({
  resizeImage: vi.fn(),
}));
vi.mock("@/hooks/useMediaUpload", () => ({
  useMediaUpload: vi.fn(),
}));

import { useMediaUpload } from "@/hooks/useMediaUpload";
import ImageUploadField from "@/components/admin/ArticleEditor/ImageUploadField";

const mockUseMediaUpload = useMediaUpload as ReturnType<typeof vi.fn>;

function makeReadyHook(captureOnSuccess: (cb: (id: string) => void) => void) {
  mockUseMediaUpload.mockImplementation((opts: { onSuccess?: (id: string) => void }) => {
    captureOnSuccess(opts.onSuccess ?? (() => {}));
    return { status: "ready", errorCode: null, upload: vi.fn(), retry: vi.fn() };
  });
}

describe("ImageUploadField — AC4: alt-required guard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows alt-required error and does not call onInsert when alt is blank and decorative is unchecked", () => {
    let onSuccess: (id: string) => void = () => {};
    makeReadyHook((cb) => { onSuccess = cb; });

    const onInsert = vi.fn();
    render(<ImageUploadField onInsert={onInsert} onCancel={vi.fn()} />);

    // Simulate completed upload so pendingMediaId is set
    act(() => { onSuccess("media-abc"); });

    // Submit with blank alt
    fireEvent.submit(document.querySelector("form")!);

    expect(screen.getByText(/alt text is required/i)).toBeInTheDocument();
    expect(onInsert).not.toHaveBeenCalled();
  });

  it("calls onInsert without alt-error when decorative is checked and alt is blank", () => {
    let onSuccess: (id: string) => void = () => {};
    makeReadyHook((cb) => { onSuccess = cb; });

    const onInsert = vi.fn();
    render(<ImageUploadField onInsert={onInsert} onCancel={vi.fn()} />);

    act(() => { onSuccess("media-abc"); });

    // Check the decorative checkbox
    fireEvent.click(screen.getByRole("checkbox"));

    // Submit
    fireEvent.submit(document.querySelector("form")!);

    expect(screen.queryByText(/alt text is required/i)).not.toBeInTheDocument();
    expect(onInsert).toHaveBeenCalledWith(
      expect.objectContaining({ decorative: true, alt: "" })
    );
  });
});
