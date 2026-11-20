"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { formatPrice } from "@/lib/utils/price";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { t } from "@/messages/en";
import { addToCart } from "@/app/actions/cart";
import { getPublicDocument } from "@/app/actions/getDocument";
import LockedPreview from "@/components/documents/LockedPreview";
import LanguagePicker from "@/components/documents/LanguagePicker";
import type { PublicDocument, DocumentLanguage, DocKind } from "@/types/document";
import type { MessageKey } from "@/messages/en";

const DOC_KIND_LABEL: Record<DocKind, MessageKey> = {
  checklist: "document_modal.kind.checklist",
  safety_sign: "document_modal.kind.safety_sign",
  toolbox_talk: "document_modal.kind.toolbox_talk",
};

type CartStatus =
  | { type: "idle" }
  | { type: "loading" }
  | { type: "toast"; message: string }
  | { type: "inline_error"; message: string };

export default function DocumentModal() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const slug = searchParams.get("document");

  const [doc, setDoc] = useState<PublicDocument | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedLang, setSelectedLang] = useState<DocumentLanguage | null>(null);
  const [status, setStatus] = useState<CartStatus>({ type: "idle" });
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear any pending toast timer on unmount to prevent stale setStatus calls
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const closeModal = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("document");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [router, pathname, searchParams]);

  // Fetch document when slug changes
  useEffect(() => {
    if (!slug) {
      setDoc(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getPublicDocument(slug)
      .then((result) => {
        if (cancelled) return;
        setLoading(false);
        if (result.ok) {
          setDoc(result.document);
          setSelectedLang(result.document.languages[0] ?? null);
        } else {
          setDoc(null);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setLoading(false);
        setDoc(null);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Escape key intentionally NOT wired: modal closes only via the X button

  // Scroll lock while open — uses a CSS class so concurrent overlays don't
  // prematurely restore scroll when one unmounts while another is still open
  useEffect(() => {
    if (!slug) return;
    document.body.classList.add("overflow-hidden");
    return () => {
      document.body.classList.remove("overflow-hidden");
    };
  }, [slug]);

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

  if (!slug) return null;

  // Loading skeleton while fetching — prevents blank modal on direct-link / slow network (AC7)
  if (loading && !doc) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("document_modal.loading")}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        {/* Backdrop — intentionally no onClick: modal closes only via the X button */}
        <div
          className="absolute inset-0 bg-black/60"
          aria-hidden="true"
          data-testid="modal-backdrop"
        />
        <div className="relative z-10 w-full max-w-2xl rounded-2xl bg-background shadow-2xl p-6 flex items-center justify-center min-h-[200px]">
          <span className="text-sm text-muted-foreground">{t("document_modal.loading")}</span>
        </div>
      </div>
    );
  }

  if (!doc) return null;

  const isLoading = status.type === "loading";
  const hasNoLanguages = doc.languages.length === 0 || doc.unavailable;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("document_modal.aria_label", { title: doc.title })}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop — intentionally no onClick: modal closes only via the X button */}
      <div
        className="absolute inset-0 bg-black/60"
        aria-hidden="true"
        data-testid="modal-backdrop"
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-2xl overflow-y-auto rounded-2xl bg-background shadow-2xl max-h-[90vh]">
        {/* Close button */}
        <button
          type="button"
          onClick={closeModal}
          aria-label={t("document_modal.close")}
          className="absolute right-4 top-4 z-20 rounded-full p-1.5 text-muted-foreground hover:bg-muted transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="grid grid-cols-1 md:grid-cols-5">
          {/* Left: cover preview */}
          <div className="md:col-span-2 px-5 pt-5 pb-0 md:pb-5">
            <LockedPreview coverImageKey={doc.coverImageKey} title={doc.title} />

            {/* Doc stats */}
            <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
              {doc.pageCount != null && doc.pageCount > 0 && (
                <span className="flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {t("document_modal.stat.pages", { count: String(doc.pageCount) })}
                </span>
              )}
              {doc.downloadCount > 0 && (
                <span className="flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  {t("document_modal.stat.downloads", { count: doc.downloadCount.toLocaleString() })}
                </span>
              )}
            </div>
          </div>

          {/* Right: details */}
          <div className="md:col-span-3 p-5 md:pl-4 flex flex-col gap-3">
            {/* Kind + category badges */}
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                {t(DOC_KIND_LABEL[doc.docKind])}
              </span>
              {doc.categoryName && (
                <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  {doc.categoryName}
                </span>
              )}
            </div>

            {/* Title */}
            <h2 className="text-lg font-bold leading-snug">{doc.title}</h2>

            {/* Price */}
            <p className="text-3xl font-extrabold text-primary">
              {t("document_modal.price", { price: formatPrice(doc.priceCents) })}
            </p>

            {/* Description */}
            {doc.description && (
              <p className="text-sm text-muted-foreground leading-relaxed border-t pt-3">
                {doc.description}
              </p>
            )}

            {/* Language picker */}
            {hasNoLanguages ? (
              <p className="text-sm text-destructive" aria-live="polite">
                {t("document_modal.unavailable_message")}
              </p>
            ) : (
              <div className="border-t pt-3">
                <p className="mb-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("language_picker.label")}</p>
                <LanguagePicker
                  availableLanguages={doc.languages}
                  selected={selectedLang}
                  onChange={setSelectedLang}
                  disabled={isLoading}
                />
              </div>
            )}

            {/* Inline error */}
            {status.type === "inline_error" && (
              <p className="text-sm text-destructive" role="alert">{status.message}</p>
            )}

            {/* Toast */}
            {status.type === "toast" && (
              <p className="text-sm text-foreground" role="status" aria-live="polite">{status.message}</p>
            )}

            {/* CTA buttons */}
            <div className="mt-auto flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={isLoading || hasNoLanguages}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
              >
                {!isLoading && (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                )}
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
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-primary px-4 py-2.5 text-sm font-semibold text-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
              >
                {isLoading ? t("document_modal.buying") : t("document_modal.buy_now")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
