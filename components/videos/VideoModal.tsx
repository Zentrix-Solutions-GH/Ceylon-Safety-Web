"use client";

import { useEffect, useRef, useState } from "react";
import { t } from "@/messages/en";
import { YouTubeEmbed } from "./YouTubeEmbed";
import { publicConfig } from "@/lib/config.public";
import type { PublicVideo } from "@/types/video";

interface VideoModalProps {
  videoId: string;
  onClose: () => void;
}

type State =
  | { status: "loading" }
  | { status: "ready"; video: PublicVideo }
  | { status: "unavailable" };

export function VideoModal({ videoId, onClose }: VideoModalProps) {
  const [state, setState] = useState<State>({ status: "loading" });
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/videos/${encodeURIComponent(videoId)}`)
      .then((res) => res.json())
      .then((data: { ok: boolean; video?: PublicVideo }) => {
        if (cancelled) return;
        if (data.ok && data.video) {
          setState({ status: "ready", video: data.video });
        } else {
          setState({ status: "unavailable" });
        }
      })
      .catch(() => {
        if (!cancelled) setState({ status: "unavailable" });
      });
    return () => { cancelled = true; };
  }, [videoId]);

  // Scroll lock
  useEffect(() => {
    if (state.status !== "ready") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [state.status]);

  // Focus trap and Escape
  useEffect(() => {
    if (state.status !== "ready") return;

    closeButtonRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute("disabled"));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [state.status, onClose]);

  // Make background inert
  useEffect(() => {
    if (state.status !== "ready") return;
    const main = document.getElementById("main-content");
    if (!main) return;
    main.setAttribute("inert", "");
    main.setAttribute("aria-hidden", "true");
    return () => {
      main.removeAttribute("inert");
      main.removeAttribute("aria-hidden");
    };
  }, [state.status]);

  if (state.status === "unavailable") {
    return (
      <p className="py-10 text-center text-gray-500">{t("video.unavailable")}</p>
    );
  }

  if (state.status === "loading") {
    return null;
  }

  const { video } = state;
  const thumbnailUrl = video.thumbnailKey
    ? `${publicConfig.mediaCdnUrl}/${video.thumbnailKey}`
    : undefined;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-0 sm:p-6"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={video.title}
        className="relative flex w-full max-w-3xl flex-col overflow-hidden rounded-none bg-black sm:rounded-xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 bg-gray-900 px-4 py-3">
          <h2 className="line-clamp-1 text-sm font-semibold text-white">{video.title}</h2>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label={t("video.modal_close")}
            onClick={onClose}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          >
            <span aria-hidden="true" className="text-lg leading-none">&times;</span>
          </button>
        </div>

        {/* Player */}
        <YouTubeEmbed
          youtubeId={video.youtubeId}
          thumbnailUrl={thumbnailUrl}
          title={video.title}
        />
      </div>
    </div>
  );
}
