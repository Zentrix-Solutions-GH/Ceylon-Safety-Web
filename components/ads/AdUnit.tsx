"use client";

import { useEffect } from "react";

interface AdUnitProps {
  clientId: string;
  slot: string;
}

export function AdUnit({ clientId, slot }: AdUnitProps) {
  useEffect(() => {
    try {
      const w = window as unknown as { adsbygoogle?: unknown[] };
      w.adsbygoogle = w.adsbygoogle ?? [];
      w.adsbygoogle.push({});
    } catch {
      // AdSense script not yet loaded; ScriptGate handles loading it after consent
    }
  }, []);

  return (
    <ins
      className="adsbygoogle"
      style={{ display: "block", width: "160px", height: "600px" }}
      data-ad-client={clientId}
      data-ad-slot={slot}
    />
  );
}
