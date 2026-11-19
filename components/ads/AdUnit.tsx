"use client";

import { useEffect, useState } from "react";
import { getConsent } from "@/lib/consent";

interface AdUnitProps {
  clientId: string;
  slot: string;
}

export function AdUnit({ clientId, slot }: AdUnitProps) {
  // Consent is unknown until after mount (cookie is client-only).
  // We start hidden so SSR and first client render agree, then reveal only on accept.
  const [consented, setConsented] = useState(false);

  useEffect(() => {
    setConsented(getConsent() === "accepted");
  }, []);

  useEffect(() => {
    if (!consented) return;
    try {
      const w = window as unknown as { adsbygoogle?: unknown[] };
      w.adsbygoogle = w.adsbygoogle ?? [];
      w.adsbygoogle.push({});
    } catch {
      // AdSense script not yet loaded; ScriptGate handles loading it after consent
    }
  }, [consented]);

  if (!consented) return null;

  return (
    <ins
      className="adsbygoogle"
      style={{ display: "block", width: "160px", height: "600px" }}
      data-ad-client={clientId}
      data-ad-slot={slot}
    />
  );
}
