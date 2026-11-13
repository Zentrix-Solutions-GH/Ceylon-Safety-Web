// S-073: PriceDialog — AC7, AC8 (version_conflict), AC9, EC4, EC5, EC9
import * as React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PriceDialog } from "../PriceDialog";
import type { ChangeDocumentPriceResult } from "@/types/document";

vi.mock("@/lib/admin/actions", () => ({
  changeDocumentPrice: vi.fn(),
}));

import { changeDocumentPrice } from "@/lib/admin/actions";
const mockChange = changeDocumentPrice as ReturnType<typeof vi.fn>;

const BASE_PROPS = {
  documentId: "doc-1",
  currentPriceCents: 100000, // LKR 1000
  onPriceChange: vi.fn(),
};

async function openDialog() {
  const user = userEvent.setup();
  render(<PriceDialog {...BASE_PROPS} />);
  await user.click(screen.getByRole("button", { name: "Change price" }));
  return user;
}

describe("PriceDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // AC7: dialog shows old and new price
  it("AC7: shows current price in dialog", async () => {
    await openDialog();
    expect(screen.getByText(/1,000/)).toBeInTheDocument(); // LKR 1000 formatted
  });

  // AC7: change <= 50% shows no second confirmation (EC4)
  it("EC4: change of exactly 50% shows no second confirmation", async () => {
    const user = await openDialog();
    // 50% of 1000 = 500; new price 1500 is exactly 50% up

    mockChange.mockResolvedValue({
      ok: true,
      documentId: "doc-1",
      newPriceCents: 150000,
      updatedAt: "2026-11-02T00:00:00Z",
    } satisfies ChangeDocumentPriceResult);

    const input = screen.getByPlaceholderText("Enter new price in LKR");
    await user.tripleClick(input);
    await user.type(input, "1500");

    // Fill authenticator code
    const mfaInput = screen.getByPlaceholderText("6-digit code");
    await user.tripleClick(mfaInput);
    await user.type(mfaInput, "123456");
    await user.click(screen.getByRole("button", { name: "Confirm change" }));

    await waitFor(() => expect(mockChange).toHaveBeenCalled());
    // No second large-change confirmation was shown
    expect(screen.queryByText(/Please confirm/)).not.toBeInTheDocument();
  });

  // EC4: change > 50% shows second confirmation
  it("EC4: change of 51% triggers large-change second confirmation", async () => {
    const user = await openDialog();
    // 51% of 1000 = 510; new price 1510 is 51% up

    // Server returns confirm_large_change on first attempt
    mockChange.mockResolvedValueOnce({
      ok: false,
      code: "validation_failed",
      reason: "confirm_large_change",
    } satisfies ChangeDocumentPriceResult);

    const input = screen.getByPlaceholderText("Enter new price in LKR");
    await user.clear(input);
    await user.type(input, "1510");
    await user.type(screen.getByPlaceholderText("6-digit code"), "123456");
    await user.click(screen.getByRole("button", { name: "Confirm change" }));

    expect(await screen.findByText("Please confirm this large price change.")).toBeInTheDocument();
  });

  // AC7: mfa_required shows dialog stays open (EC5)
  it("EC5: mfa_required keeps dialog open with error message", async () => {
    const user = await openDialog();

    mockChange.mockResolvedValue({
      ok: false,
      code: "mfa_required",
    } satisfies ChangeDocumentPriceResult);

    const input = screen.getByPlaceholderText("Enter new price in LKR");
    await user.tripleClick(input);
    await user.type(input, "1200");
    const mfaInput = screen.getByPlaceholderText("6-digit code");
    await user.tripleClick(mfaInput);
    await user.type(mfaInput, "000000");

    await user.click(screen.getByRole("button", { name: "Confirm change" }));

    expect(await screen.findByText("Enter the code from your authenticator app.")).toBeInTheDocument();
    // Dialog still open
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  // AC9: version_conflict closes dialog and shows message
  it("AC9: version_conflict closes dialog and shows conflict message", async () => {
    const user = await openDialog();

    mockChange.mockResolvedValue({
      ok: false,
      code: "version_conflict",
    } satisfies ChangeDocumentPriceResult);

    const input = screen.getByPlaceholderText("Enter new price in LKR");
    await user.tripleClick(input);
    await user.type(input, "1200");
    const mfaInput = screen.getByPlaceholderText("6-digit code");
    await user.tripleClick(mfaInput);
    await user.type(mfaInput, "123456");
    await user.click(screen.getByRole("button", { name: "Confirm change" }));

    // Dialog closed
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    // Error shown outside dialog
    expect(
      screen.getByText(
        "Someone else changed this while you were editing. Reload to see their changes. Your text is kept."
      )
    ).toBeInTheDocument();
  });

  // AC7: successful price change calls onPriceChange
  it("AC7: successful change calls onPriceChange and closes dialog", async () => {
    const onPriceChange = vi.fn();
    const user = userEvent.setup();
    render(<PriceDialog {...BASE_PROPS} onPriceChange={onPriceChange} />);

    mockChange.mockResolvedValue({
      ok: true,
      documentId: "doc-1",
      newPriceCents: 120000,
      updatedAt: "2026-11-02T00:00:00Z",
    } satisfies ChangeDocumentPriceResult);

    await user.click(screen.getByRole("button", { name: "Change price" }));

    const input = screen.getByPlaceholderText("Enter new price in LKR");
    await user.tripleClick(input);
    await user.type(input, "1200");
    const mfaInput = screen.getByPlaceholderText("6-digit code");
    await user.tripleClick(mfaInput);
    await user.type(mfaInput, "123456");
    await user.click(screen.getByRole("button", { name: "Confirm change" }));

    await waitFor(() => expect(onPriceChange).toHaveBeenCalledWith(120000, "2026-11-02T00:00:00Z"));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
