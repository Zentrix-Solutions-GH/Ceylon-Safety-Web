"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { t } from "@/messages/en";
import { addToCart } from "@/app/actions/cart";
import { getPublicDocument } from "@/app/actions/getDocument";
import LockedPreview from "@/components/documents/LockedPreview";
import LanguagePicker from "@/components/documents/LanguagePicker";
import type { PublicDocument, DocumentLanguage } from "@/types/document";

type CartStatus =
  | { type: "idle" }
  | { type: "loading" }
  | { type: "toast"; message: string }
  | { type: "inline_error"; message: string };

function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function DocumentModal() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const slug = searchParams.get("document");

  const [doc, setDoc] = useState<PublicDocument | null>(null);
  const [selectedLang, setSelectedLang] = useState<DocumentLanguage | null>(null);
  const [status, setStatus] = useState<CartStatus>({ type: "idle" });
  const backdropRef = useRef<HTMLDivElement>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear any pending toast timer on unmount to prevent stale setStatus calls
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const closeModal = useCallback(() => {
    router.replace(pathname);
  }, [router, pathname]);

  // Fetch document when slug changes
  useEffect(() => {
    if (!slug) {
      setDoc(null);
      return;
    }
    let cancelled = false;
    getPublicDocument(slug).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setDoc(result.document);
        setSelectedLang(result.document.languages[0] ?? null);
      } else {
        setDoc(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Escape key closes modal
  useEffect(() => {
    if (!doc) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeModal();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [doc, closeModal]);

  // Scroll lock while open — uses a CSS class so concurrent overlays don't
  // prematurely restore scroll when one unmounts while another is still open
  useEffect(() => {
    if (!doc) return;
    document.body.classList.add("overflow-hidden");
    return () => {
      document.body.classList.remove("overflow-hidden");
    };
  }, [doc]);

  // Clear toast after 3s
  function showToast(message: string) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setStatus({ type: "toast", message });
    toastTimerRef.current = setTimeout(() => setStatus({ type: "idle" }), 3000);
  }

  async function handleAddToCart() {
    if (!doc || !selectedLang || status.type === "loading") return;
    setStatus({ type: "loading" });

    const result = await addToCart(doc.id, selectedLang);

    if (!result.ok) {
      if (result.code === "not_signed_in") {
        const next = encodeURIComponent(`/documents?document=${doc.slug}`);
        router.push(`/sign-in?next=${next}`);
        setStatus({ type: "idle" });
        return;
      }
      if (result.code === "already_in_cart") {
        showToast(t("document_modal.toast.already_in_cart"));
        return;
      }
      if (result.code === "cart_full") {
        showToast(t("document_modal.toast.cart_full"));
        return;
      }
      if (result.code === "document_unavailable") {
        setStatus({ type: "inline_error", message: t("document_modal.toast.unavailable") });
        return;
      }
      showToast(t("document_modal.toast.unavailable"));
      return;
    }

    router.refresh(); // revalidates server components so header cart count updates (AC3)
    showToast(t("document_modal.toast.added"));
  }

  async function handleBuyNow() {
    if (!doc || !selectedLang || status.type === "loading") return;
    setStatus({ type: "loading" });

    const result = await addToCart(doc.id, selectedLang);

    if (!result.ok) {
      if (result.code === "not_signed_in") {
        const next = encodeURIComponent(`/documents?document=${doc.slug}`);
        router.push(`/sign-in?next=${next}`);
        setStatus({ type: "idle" });
        return;
      }
      if (result.code === "document_unavailable") {
        setStatus({ type: "inline_error", message: t("document_modal.toast.unavailable") });
        return;
      }
      if (result.code === "cart_full") {
        showToast(t("document_modal.toast.cart_full"));
        return;
      }
      // already_in_cart → still proceed to checkout
    }

    router.push("/checkout");
  }

  if (!slug || !doc) return null;

  const isLoading = status.type === "loading";
  const hasNoLanguages = doc.languages.length === 0 || doc.unavailable;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={doc.title}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        ref={backdropRef}
        className="absolute inset-0 bg-black/60"
        onClick={closeModal}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-lg overflow-y-auto rounded-2xl bg-background shadow-2xl max-h-[90vh]">
        {/* Close button */}
        <button
          type="button"
          onClick={closeModal}
          aria-label={t("document_modal.close")}
          className="absolute right-4 top-4 z-10 rounded-full p-1.5 text-muted-foreground hover:bg-muted"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        <div className="p-6 space-y-4">
          {/* Cover / locked preview */}
          <LockedPreview coverImageKey={doc.coverImageKey} title={doc.title} />

          {/* Title */}
          <h2 className="text-xl font-semibold leading-snug">{doc.title}</h2>

          {/* Category */}
          {doc.categoryName && (
            <span className="inline-block rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              {doc.categoryName}
            </span>
          )}

          {/* Price */}
          <p className="text-2xl font-bold text-primary">
            {t("document_modal.price", { price: formatPrice(doc.priceCents) })}
          </p>

          {/* Description */}
          {doc.description && (
            <p className="text-sm text-muted-foreground leading-relaxed">{doc.description}</p>
          )}

          {/* Language picker */}
          {hasNoLanguages ? (
            <p className="text-sm text-destructive" aria-live="polite">
              {t("document_modal.unavailable_message")}
            </p>
          ) : (
            <LanguagePicker
              availableLanguages={doc.languages}
              selected={selectedLang}
              onChange={setSelectedLang}
              disabled={isLoading}
            />
          )}

          {/* Inline error */}
          {status.type === "inline_error" && (
            <p className="text-sm text-destructive" role="alert">
              {status.message}
            </p>
          )}

          {/* Toast */}
          {status.type === "toast" && (
            <p className="text-sm text-foreground" role="status" aria-live="polite">
              {status.message}
            </p>
          )}

          {/* CTA buttons */}
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={isLoading || hasNoLanguages}
              className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading
                ? t("document_modal.adding")
                : hasNoLanguages
                  ? t("document_modal.unavailable_label")
                  : t("document_modal.add_to_cart")}
            </button>
            <button
              type="button"
              onClick={handleBuyNow}
              disabled={isLoading || hasNoLanguages}
              className="flex-1 rounded-lg border border-primary px-4 py-2.5 text-sm font-semibold text-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? t("document_modal.buying") : t("document_modal.buy_now")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
