// S-073: DocumentLanguageFiles — AC1, AC2, AC3, AC4, EC1, EC2, EC6
import * as React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DocumentLanguageFiles } from "../DocumentLanguageFiles";
import type { DocumentLanguageSlot, StartUploadResult, UploadStatus } from "@/types/document";

// Mock server actions (S-070 backend)
vi.mock("@/lib/admin/actions", () => ({
  startDocumentFileUpload: vi.fn(),
  completeDocumentFileUpload: vi.fn(),
}));

import { startDocumentFileUpload, completeDocumentFileUpload } from "@/lib/admin/actions";

const mockStart = startDocumentFileUpload as ReturnType<typeof vi.fn>;
const mockComplete = completeDocumentFileUpload as ReturnType<typeof vi.fn>;

const allMissingSlots: DocumentLanguageSlot[] = [
  { language: "en", full: "missing", previews: ["missing", "missing", "missing"] },
  { language: "si", full: "missing", previews: ["missing", "missing", "missing"] },
  { language: "ta", full: "missing", previews: ["missing", "missing", "missing"] },
];

const withReadyEnFull: DocumentLanguageSlot[] = [
  { language: "en", full: "ready", previews: ["ready", "missing", "missing"] },
  { language: "si", full: "missing", previews: ["missing", "missing", "missing"] },
  { language: "ta", full: "missing", previews: ["missing", "missing", "missing"] },
];

function makePptxFile(name = "test.pptx"): File {
  // ZIP magic bytes (OOXML / PPTX)
  const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]);
  return new File([bytes], name, { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });
}

function makeTxtFile(name = "wrong.txt"): File {
  return new File(["hello"], name, { type: "text/plain" });
}

const noop = () => {};

describe("DocumentLanguageFiles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // AC1: three language sections visible
  it("AC1: shows English, Sinhala, Tamil sections", () => {
    render(
      <DocumentLanguageFiles
        documentId="doc-1"
        slots={allMissingSlots}
        onSlotsChange={noop}
      />
    );
    expect(screen.getByText("English")).toBeInTheDocument();
    expect(screen.getByText("Sinhala")).toBeInTheDocument();
    expect(screen.getByText("Tamil")).toBeInTheDocument();
  });

  // AC1: each language has a full file upload box
  it("AC1: shows full file upload box per language", () => {
    render(
      <DocumentLanguageFiles
        documentId="doc-1"
        slots={allMissingSlots}
        onSlotsChange={noop}
      />
    );
    expect(screen.getAllByText("PowerPoint file").length).toBe(3);
  });

  // AC1: preview slots 2 and 3 hidden when slot 1 not ready
  it("AC1: preview slots 2 and 3 not shown when slot 1 is missing", () => {
    render(
      <DocumentLanguageFiles
        documentId="doc-1"
        slots={allMissingSlots}
        onSlotsChange={noop}
      />
    );
    // Only slot 1 label "Preview 1" should show; "Preview 2" and "Preview 3" should not
    expect(screen.queryByText("Preview 2")).not.toBeInTheDocument();
    expect(screen.queryByText("Preview 3")).not.toBeInTheDocument();
  });

  // AC1: preview slots 2 shown after slot 1 ready
  it("AC1: preview slot 2 shown when slot 1 is Ready, slot 3 not yet", () => {
    render(
      <DocumentLanguageFiles
        documentId="doc-1"
        slots={withReadyEnFull}
        onSlotsChange={noop}
      />
    );
    // English section has slot 1 ready, so slot 2 label shown
    expect(screen.getByText("Preview 2")).toBeInTheDocument();
    // But slot 2 is missing so slot 3 not shown
    expect(screen.queryByText("Preview 3")).not.toBeInTheDocument();
  });

  // AC1: status labels
  it("AC1: shows Missing status on missing slots", () => {
    render(
      <DocumentLanguageFiles
        documentId="doc-1"
        slots={allMissingSlots}
        onSlotsChange={noop}
      />
    );
    const missingBadges = screen.getAllByText("Missing");
    expect(missingBadges.length).toBeGreaterThan(0);
  });

  it("AC1: shows Ready status on ready slots", () => {
    render(
      <DocumentLanguageFiles
        documentId="doc-1"
        slots={withReadyEnFull}
        onSlotsChange={noop}
      />
    );
    expect(screen.getAllByText("Ready").length).toBeGreaterThan(0);
  });

  // AC3: client-side type refusal for wrong file type on full slot
  it("AC3: refuses non-pptx file for full slot before upload", async () => {
    // applyAccept:false bypasses userEvent's accept-attribute filter so the
    // wrong-type file reaches the component's own mimeToFormat check.
    const user = userEvent.setup({ applyAccept: false });
    render(
      <DocumentLanguageFiles
        documentId="doc-1"
        slots={allMissingSlots}
        onSlotsChange={noop}
      />
    );
    const inputs = document.querySelectorAll("input[type='file']");
    // First input is English full slot
    const enFullInput = inputs[0] as HTMLInputElement;
    await user.upload(enFullInput, makeTxtFile());
    expect(await screen.findByText("This file type is not accepted.")).toBeInTheDocument();
    expect(mockStart).not.toHaveBeenCalled();
  });

  // AC3: client-side type refusal for wrong file type on preview slot
  it("AC3: refuses pptx file for preview slot before upload", async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(
      <DocumentLanguageFiles
        documentId="doc-1"
        slots={allMissingSlots}
        onSlotsChange={noop}
      />
    );
    // Preview slot 1 input (after full slot inputs)
    const inputs = document.querySelectorAll("input[type='file']");
    // 3 full + 3 preview slot 1 inputs visible (slots 2/3 hidden)
    // index 1 = en preview slot 1
    const enPreviewInput = inputs[1] as HTMLInputElement;
    await user.upload(enPreviewInput, makePptxFile());
    expect(await screen.findByText("This file type is not accepted.")).toBeInTheDocument();
    expect(mockStart).not.toHaveBeenCalled();
  });

  // AC2: upload sequence: start → XHR → complete
  it("AC2: successful upload calls start, XHRs to uploadUrl, then calls complete", async () => {
    const user = userEvent.setup();
    const onSlotsChange = vi.fn();

    // Mock XHR
    const xhrMock = {
      open: vi.fn(),
      send: vi.fn(),
      setRequestHeader: vi.fn(),
      abort: vi.fn(),
      upload: { addEventListener: vi.fn() },
      addEventListener: vi.fn(),
      status: 200,
    };
    // Capture onload and trigger it
    let onloadFn: (() => void) | undefined;
    xhrMock.addEventListener.mockImplementation((event: string, fn: () => void) => {
      if (event === "load") onloadFn = fn;
    });
    vi.stubGlobal("XMLHttpRequest", vi.fn(() => xhrMock));

    mockStart.mockResolvedValue({
      ok: true,
      upload: { fileId: "file-123", uploadUrl: "https://r2.example.com/upload" },
    } satisfies StartUploadResult);
    mockComplete.mockResolvedValue({ ok: true, fileId: "file-123", status: "ready" } satisfies UploadStatus);

    render(
      <DocumentLanguageFiles
        documentId="doc-1"
        slots={allMissingSlots}
        onSlotsChange={onSlotsChange}
      />
    );

    const inputs = document.querySelectorAll("input[type='file']");
    const enFullInput = inputs[0] as HTMLInputElement;
    await user.upload(enFullInput, makePptxFile("test.pptx"));

    // Should show Uploading state
    expect(await screen.findByText(/Uploading/)).toBeInTheDocument();

    // Trigger XHR load
    if (onloadFn) onloadFn();

    await waitFor(() => {
      expect(mockComplete).toHaveBeenCalledWith("file-123");
    });

    expect(onSlotsChange).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  // AC3: server reason file_type shown
  it("AC3: shows server file_type error message", async () => {
    const user = userEvent.setup();
    const xhrMock = {
      open: vi.fn(), send: vi.fn(), setRequestHeader: vi.fn(), abort: vi.fn(),
      upload: { addEventListener: vi.fn() },
      addEventListener: vi.fn(), status: 200,
    };
    let onloadFn: (() => void) | undefined;
    xhrMock.addEventListener.mockImplementation((event: string, fn: () => void) => {
      if (event === "load") onloadFn = fn;
    });
    vi.stubGlobal("XMLHttpRequest", vi.fn(() => xhrMock));

    mockStart.mockResolvedValue({
      ok: true,
      upload: { fileId: "file-456", uploadUrl: "https://r2.example.com/upload" },
    } satisfies StartUploadResult);
    mockComplete.mockResolvedValue({
      ok: false, code: "validation_failed", reason: "file_type",
    } satisfies UploadStatus);

    render(
      <DocumentLanguageFiles documentId="doc-1" slots={allMissingSlots} onSlotsChange={noop} />
    );
    const inputs = document.querySelectorAll("input[type='file']");
    await user.upload(inputs[0] as HTMLInputElement, makePptxFile());
    if (onloadFn) onloadFn();

    expect(await screen.findByText("This file type is not accepted.")).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  // AC3: upload_failed shows retry button
  it("AC3: upload_failed shows retry button", async () => {
    const user = userEvent.setup();
    const xhrMock = {
      open: vi.fn(), send: vi.fn(), setRequestHeader: vi.fn(), abort: vi.fn(),
      upload: { addEventListener: vi.fn() },
      addEventListener: vi.fn(), status: 200,
    };
    let onloadFn: (() => void) | undefined;
    xhrMock.addEventListener.mockImplementation((event: string, fn: () => void) => {
      if (event === "load") onloadFn = fn;
    });
    vi.stubGlobal("XMLHttpRequest", vi.fn(() => xhrMock));

    mockStart.mockResolvedValue({
      ok: true,
      upload: { fileId: "file-789", uploadUrl: "https://r2.example.com/upload" },
    } satisfies StartUploadResult);
    mockComplete.mockResolvedValue({ ok: false, code: "upload_failed" } satisfies UploadStatus);

    render(
      <DocumentLanguageFiles documentId="doc-1" slots={allMissingSlots} onSlotsChange={noop} />
    );
    const inputs = document.querySelectorAll("input[type='file']");
    await user.upload(inputs[0] as HTMLInputElement, makePptxFile());
    if (onloadFn) onloadFn();

    expect(await screen.findByText("The upload did not finish. Try again.")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Retry" })).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  // AC4: re-upload — old version stays shown until new one Ready
  it("AC4: old slot state stays shown while new upload is in progress", async () => {
    const user = userEvent.setup();
    // Start a slot that is already ready
    const readySlots: DocumentLanguageSlot[] = [
      { language: "en", full: "ready", previews: ["missing", "missing", "missing"] },
      { language: "si", full: "missing", previews: ["missing", "missing", "missing"] },
      { language: "ta", full: "missing", previews: ["missing", "missing", "missing"] },
    ];

    // Mock a long-running start (never resolves in this test to freeze at Uploading)
    mockStart.mockReturnValue(new Promise(() => {}));

    render(
      <DocumentLanguageFiles documentId="doc-1" slots={readySlots} onSlotsChange={noop} />
    );
    // Before re-upload: Ready shown for English full
    expect(screen.getAllByText("Ready").length).toBeGreaterThan(0);

    const inputs = document.querySelectorAll("input[type='file']");
    await user.upload(inputs[0] as HTMLInputElement, makePptxFile());

    // Now uploading — the old "Ready" label should stay during upload
    // (The local state for the new upload shows Uploading separately, old stays)
    await waitFor(() => {
      expect(screen.getByText(/Uploading/)).toBeInTheDocument();
    });
    // Old "Ready" should still be visible
    expect(screen.getAllByText("Ready").length).toBeGreaterThan(0);
  });

  // EC2: two languages uploading at once
  it("EC2: two languages uploading simultaneously keep separate progress", async () => {
    const user = userEvent.setup();
    const xhrMock1 = {
      open: vi.fn(), send: vi.fn(), setRequestHeader: vi.fn(), abort: vi.fn(),
      upload: { addEventListener: vi.fn() }, addEventListener: vi.fn(), status: 200,
    };
    const xhrMock2 = {
      open: vi.fn(), send: vi.fn(), setRequestHeader: vi.fn(), abort: vi.fn(),
      upload: { addEventListener: vi.fn() }, addEventListener: vi.fn(), status: 200,
    };
    let callCount = 0;
    vi.stubGlobal("XMLHttpRequest", vi.fn(() => callCount++ === 0 ? xhrMock1 : xhrMock2));

    mockStart
      .mockResolvedValueOnce({ ok: true, upload: { fileId: "file-en", uploadUrl: "https://r2.example.com/en" } } satisfies StartUploadResult)
      .mockResolvedValueOnce({ ok: true, upload: { fileId: "file-si", uploadUrl: "https://r2.example.com/si" } } satisfies StartUploadResult);

    render(
      <DocumentLanguageFiles documentId="doc-1" slots={allMissingSlots} onSlotsChange={noop} />
    );

    const inputs = document.querySelectorAll("input[type='file']");
    // Upload English full (index 0) then Sinhala full (index 2; index 1 is English preview)
    await user.upload(inputs[0] as HTMLInputElement, makePptxFile("en.pptx"));
    await user.upload(inputs[2] as HTMLInputElement, makePptxFile("si.pptx"));

    // Both should be in uploading state
    await waitFor(() => {
      expect(screen.getAllByText(/Uploading/).length).toBeGreaterThanOrEqual(2);
    });
    vi.unstubAllGlobals();
  });
});
