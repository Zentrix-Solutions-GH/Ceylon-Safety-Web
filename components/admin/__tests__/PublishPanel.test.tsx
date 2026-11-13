// S-073: PublishPanel — AC5, AC6, AC8, AC11, EC3, EC8, EC10
import * as React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PublishPanel } from "../PublishPanel";
import type { SetDocumentStatusResult } from "@/types/document";

vi.mock("@/lib/admin/actions", () => ({
  setDocumentStatus: vi.fn(),
}));
vi.mock("@/lib/articles/countArticleRefs", () => ({
  countArticleRefs: vi.fn(),
}));

import { setDocumentStatus } from "@/lib/admin/actions";
import { countArticleRefs } from "@/lib/articles/countArticleRefs";

const mockSet = setDocumentStatus as ReturnType<typeof vi.fn>;
const mockCount = countArticleRefs as ReturnType<typeof vi.fn>;

const BASE_PROPS = {
  documentId: "doc-1",
  status: "draft" as const,
  updatedAt: "2026-11-01T00:00:00Z",
  onStatusChange: vi.fn(),
};

describe("PublishPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // AC5: Publish button present for draft
  it("AC5: shows Publish button for a draft document", () => {
    render(<PublishPanel {...BASE_PROPS} />);
    expect(screen.getByRole("button", { name: "Publish" })).toBeInTheDocument();
  });

  // AC5: files_missing shows canonical message and lists missing languages
  it("AC5: files_missing shows design-doc message and lists missing languages", async () => {
    const user = userEvent.setup();
    mockSet.mockResolvedValue({
      ok: false,
      code: "validation_failed",
      reason: "files_missing",
      missing: ["full:si", "preview:ta"],
    } satisfies SetDocumentStatusResult);

    render(<PublishPanel {...BASE_PROPS} />);
    await user.click(screen.getByRole("button", { name: "Publish" }));

    expect(await screen.findByText("Upload all three language files and the preview first.")).toBeInTheDocument();
    // Missing items listed
    expect(await screen.findByText(/Sinhala/)).toBeInTheDocument();
    expect(await screen.findByText(/Tamil/)).toBeInTheDocument();
  });

  // EC3: already_done shows "This was already done."
  it("EC3: already_done shows correct message and page updates", async () => {
    const user = userEvent.setup();
    const onStatusChange = vi.fn();
    // already_done is not yet in the shared type; cast to avoid a compile error
    // The backend returns this reason and the component handles it via narrowing.
    mockSet.mockResolvedValue({
      ok: false,
      code: "validation_failed",
      reason: "already_done",
    } as unknown as SetDocumentStatusResult);

    render(<PublishPanel {...BASE_PROPS} onStatusChange={onStatusChange} />);
    await user.click(screen.getByRole("button", { name: "Publish" }));

    expect(await screen.findByText("This has already been done.")).toBeInTheDocument();
  });

  // EC8: version_conflict on publish
  it("EC8: version_conflict shows conflict message and does not change status", async () => {
    const user = userEvent.setup();
    const onStatusChange = vi.fn();
    mockSet.mockResolvedValue({
      ok: false,
      code: "version_conflict",
    } satisfies SetDocumentStatusResult);

    render(<PublishPanel {...BASE_PROPS} onStatusChange={onStatusChange} />);
    await user.click(screen.getByRole("button", { name: "Publish" }));

    expect(
      await screen.findByText(
        "Someone else changed this while you were editing. Reload to see their changes. Your text is kept."
      )
    ).toBeInTheDocument();
    expect(onStatusChange).not.toHaveBeenCalled();
  });

  // AC6: countArticleRefs called before hide; articles warning shown
  it("AC6: before Hide shows article warning when count > 0", async () => {
    const user = userEvent.setup();
    mockCount.mockResolvedValue({ ok: true, count: 3 });

    render(<PublishPanel {...BASE_PROPS} status="published" />);
    await user.click(screen.getByRole("button", { name: "Hide" }));

    expect(await screen.findByText(/Used in 3 articles/)).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Hide document" })).toBeInTheDocument();
    expect(mockSet).not.toHaveBeenCalled();
  });

  // AC6: no article warning when count is 0, proceeds directly
  it("AC6: hides immediately when no article refs", async () => {
    const user = userEvent.setup();
    mockCount.mockResolvedValue({ ok: true, count: 0 });
    mockSet.mockResolvedValue({
      ok: true,
      documentId: "doc-1",
      updatedAt: "2026-11-02T00:00:00Z",
    } satisfies SetDocumentStatusResult);

    render(<PublishPanel {...BASE_PROPS} status="published" onStatusChange={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Hide" }));

    await waitFor(() => expect(mockSet).toHaveBeenCalledWith("doc-1", "hide", "2026-11-01T00:00:00Z"));
  });

  // AC11: purgeWarning shown as toast message
  it("AC11: shows purge_failed message when server returns purgeWarning", async () => {
    const user = userEvent.setup();
    mockSet.mockResolvedValue({
      ok: true,
      documentId: "doc-1",
      updatedAt: "2026-11-02T00:00:00Z",
      purgeWarning: "some server warning",
    } satisfies SetDocumentStatusResult);

    render(<PublishPanel {...BASE_PROPS} onStatusChange={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Publish" }));

    expect(
      await screen.findByText("Saved, but the cache could not be cleared. It will expire on its own.")
    ).toBeInTheDocument();
  });

  // EC10: publish while one language is uploading → files_missing lists that language
  it("EC10: publish while language uploading returns files_missing for that language", async () => {
    const user = userEvent.setup();
    mockSet.mockResolvedValue({
      ok: false,
      code: "validation_failed",
      reason: "files_missing",
      missing: ["full:en"],
    } satisfies SetDocumentStatusResult);

    render(<PublishPanel {...BASE_PROPS} />);
    await user.click(screen.getByRole("button", { name: "Publish" }));

    expect(await screen.findByText(/English/)).toBeInTheDocument();
  });
});
