"use client";

import { t } from "@/messages/en";

interface DocumentModalProps {
  slug: string | null;
  onClose: () => void;
}

export function DocumentModal({ slug, onClose }: DocumentModalProps) {
  if (!slug) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("documents.modal.label")}
        className="relative w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t("documents.modal.close")}
          className="absolute right-4 top-4 rounded p-1 text-gray-500 hover:bg-gray-100"
        >
          ✕
        </button>
        <p className="text-sm text-gray-500">{t("documents.modal.loading")}</p>
      </div>
    </div>
  );
}

export default DocumentModal;
