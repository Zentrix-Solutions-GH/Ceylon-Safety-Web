"use client";

import type { ReactNode } from "react";

// Stub: renders nothing until S-028 (consent store) and S-113 (ad scripts) provide work.
// ASSUMPTION: frontend architecture 19 — ScriptGate renders nothing on first render.
export function ScriptGate({ children }: { children?: ReactNode }) {
  void children;
  return null;
}
