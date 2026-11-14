"use client";
import * as React from "react";
import { t, errorMessage } from "@/messages/en";
import { changeDocumentPrice } from "@/lib/admin/actions";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  documentId: string;
  currentPriceCents: number;
  onPriceChange?: (newPriceCents: number, updatedAt: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatLkr(cents: number): string {
  return (cents / 100).toLocaleString("en-LK");
}

function changePercent(oldCents: number, newCents: number): number {
  if (oldCents === 0) return 0;
  return Math.abs((newCents - oldCents) / oldCents) * 100;
}

// ---------------------------------------------------------------------------
// PriceDialog
// ---------------------------------------------------------------------------

export function PriceDialog({ documentId, currentPriceCents, onPriceChange }: Props) {
  const [open, setOpen] = React.useState(false);
  const [newPriceLkr, setNewPriceLkr] = React.useState("");
  const [mfaCode, setMfaCode] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [externalError, setExternalError] = React.useState<string | null>(null);
  const [confirmedLarge, setConfirmedLarge] = React.useState(false);
  const [needsLargeConfirm, setNeedsLargeConfirm] = React.useState(false);

  function openDialog() {
    setOpen(true);
    setNewPriceLkr("");
    setMfaCode("");
    setError(null);
    setExternalError(null);
    setConfirmedLarge(false);
    setNeedsLargeConfirm(false);
  }

  function closeDialog() {
    setOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const parsedLkr = parseFloat(newPriceLkr);
    if (!isFinite(parsedLkr) || parsedLkr <= 0) {
      setError(errorMessage("validation_failed"));
      setPending(false);
      return;
    }
    const newPriceCentsNum = Math.round(parsedLkr * 100);
    const pct = changePercent(currentPriceCents, newPriceCentsNum);
    const isLarge = pct > 50;

    const result = await changeDocumentPrice({
      documentId,
      newPriceLkr: parsedLkr,
      confirmedLargeChange: confirmedLarge || !isLarge,
      authenticatorCode: mfaCode,
    });

    setPending(false);

    if (!result.ok) {
      if (result.code === "mfa_required") {
        setError(errorMessage("mfa_required"));
        return;
      }
      if (result.code === "version_conflict") {
        setExternalError(errorMessage("version_conflict"));
        closeDialog();
        return;
      }
      if (result.code === "validation_failed") {
        const reason = (result as { reason?: string }).reason;
        if (reason === "confirm_large_change") {
          setNeedsLargeConfirm(true);
          setError(errorMessage("validation_failed", "confirm_large_change"));
          return;
        }
        setError(errorMessage("validation_failed", reason));
        return;
      }
      setError(errorMessage(result.code));
      return;
    }

    onPriceChange?.(result.newPriceCents, result.updatedAt);
    closeDialog();
  }

  return (
    <>
      {/* Trigger button */}
      <button
        type="button"
        onClick={openDialog}
        className="inline-flex items-center rounded px-3 py-1.5 text-sm font-medium border"
      >
        {t("admin.documents.price.change_button")}
      </button>

      {/* External error shown outside dialog (e.g. version_conflict after close) */}
      {externalError && !open && (
        <p role="alert" className="text-sm text-destructive mt-2">{externalError}</p>
      )}

      {/* Dialog */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="price-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        >
          <div className="bg-background rounded-lg shadow-lg p-6 w-full max-w-sm space-y-4">
            <h2 id="price-dialog-title" className="text-lg font-semibold">
              {t("admin.documents.price.dialog_title")}
            </h2>

            {/* Old / new price */}
            <div className="flex gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">{t("admin.documents.price.old_label")}</p>
                <p className="font-medium">LKR {formatLkr(currentPriceCents)}</p>
              </div>
              {newPriceLkr && !isNaN(parseFloat(newPriceLkr)) && (
                <div>
                  <p className="text-muted-foreground">{t("admin.documents.price.new_label")}</p>
                  <p className="font-medium">LKR {formatLkr(parseFloat(newPriceLkr) * 100)}</p>
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              {/* New price input */}
              <div>
                <label htmlFor="new-price" className="text-sm font-medium">
                  {t("admin.documents.price.new_label")}
                </label>
                <input
                  id="new-price"
                  type="number"
                  min="1"
                  step="1"
                  value={newPriceLkr}
                  onChange={(e) => {
                    setNewPriceLkr(e.target.value);
                    setNeedsLargeConfirm(false);
                    setConfirmedLarge(false);
                    setError(null);
                  }}
                  placeholder={t("admin.documents.price.new_placeholder")}
                  className="mt-1 w-full border rounded px-3 py-2 text-sm"
                  required
                />
              </div>

              {/* Large change warning (second confirmation) */}
              {needsLargeConfirm && (
                <div className="rounded bg-amber-50 border border-amber-200 p-3 space-y-2">
                  <p className="text-sm text-amber-800">
                    {t("admin.documents.price.large_change_warning").replace(
                      "{pct}",
                      String(
                        Math.round(
                          changePercent(currentPriceCents, parseFloat(newPriceLkr) * 100)
                        )
                      )
                    )}
                  </p>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={confirmedLarge}
                      onChange={(e) => setConfirmedLarge(e.target.checked)}
                    />
                    {t("admin.documents.price.large_change_confirm")}
                  </label>
                </div>
              )}

              {/* Authenticator code */}
              <div>
                <label htmlFor="mfa-code" className="text-sm font-medium">
                  {t("admin.documents.price.mfa_label")}
                </label>
                <input
                  id="mfa-code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  placeholder={t("admin.documents.price.mfa_placeholder")}
                  className="mt-1 w-full border rounded px-3 py-2 text-sm"
                  required
                />
              </div>

              {/* Error */}
              {error && (
                <p role="alert" className="text-sm text-destructive">{error}</p>
              )}

              {/* Actions */}
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={closeDialog}
                  className="rounded px-3 py-1.5 text-sm border"
                >
                  {t("admin.documents.price.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground disabled:opacity-50"
                >
                  {pending
                    ? t("admin.documents.price.confirming")
                    : t("admin.documents.price.confirm_button")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
