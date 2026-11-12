"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { VideoModal } from "./VideoModal";

export function VideoModalLoader() {
  const params = useSearchParams();
  const router = useRouter();
  const videoId = params.get("video");
  // Capture the element that opened the modal so focus can return on close (AC6)
  const triggerRef = useRef<Element | null>(null);

  useEffect(() => {
    if (videoId && !triggerRef.current) {
      triggerRef.current = document.activeElement;
    }
    if (!videoId) {
      triggerRef.current = null;
    }
  }, [videoId]);

  // noindex while a video is open (AC2)
  useEffect(() => {
    if (!videoId) return;
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex";
    meta.setAttribute("data-video-popup", "1");
    document.head.appendChild(meta);
    return () => {
      const existing = document.head.querySelector('meta[data-video-popup="1"]');
      existing?.remove();
    };
  }, [videoId]);

  function handleClose() {
    // Remove ?video= without reloading (AC7)
    const url = new URL(window.location.href);
    url.searchParams.delete("video");
    router.replace(url.pathname + (url.search || ""), { scroll: false });
    // Defer focus restore so the re-render triggered by router.replace
    // completes before we attempt to focus the trigger element (AC6)
    const trigger = triggerRef.current;
    triggerRef.current = null;
    requestAnimationFrame(() => {
      if (trigger instanceof HTMLElement) trigger.focus();
    });
  }

  if (!videoId) return null;

  return <VideoModal key={videoId} videoId={videoId} onClose={handleClose} />;
}
