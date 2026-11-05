"use client";

import { useEffect, useRef, useCallback } from "react";
import Script from "next/script";
import { publicConfig } from "@/lib/config.public";

interface TurnstileWidgetProps {
  onToken: (token: string) => void;
  onError?: () => void;
  /** Pass a ref setter so the caller can reset the widget after a submission. */
  onRef?: (reset: () => void) => void;
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "error-callback"?: () => void;
          "expired-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
        }
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

export function TurnstileWidget({ onToken, onError, onRef }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  const render = useCallback(() => {
    if (!containerRef.current || !window.turnstile) return;
    // Remove any existing widget before re-rendering
    if (widgetIdRef.current !== null) {
      try { window.turnstile.remove(widgetIdRef.current); } catch { /* ignore */ }
      widgetIdRef.current = null;
    }
    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: publicConfig.turnstileSiteKey,
      callback: onToken,
      "error-callback": onError,
      "expired-callback": onError,
    });
    if (onRef) {
      onRef(() => {
        if (widgetIdRef.current !== null && window.turnstile) {
          window.turnstile.reset(widgetIdRef.current);
        }
      });
    }
  }, [onToken, onError, onRef]);

  useEffect(() => {
    // If Turnstile script already loaded (e.g. HMR), render immediately
    if (window.turnstile) {
      render();
    }
    return () => {
      if (widgetIdRef.current !== null && window.turnstile) {
        try { window.turnstile.remove(widgetIdRef.current); } catch { /* ignore */ }
      }
    };
  }, [render]);

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="lazyOnload"
        onLoad={render}
      />
      <div ref={containerRef} />
    </>
  );
}
