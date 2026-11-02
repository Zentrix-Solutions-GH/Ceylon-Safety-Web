"use client";

// AC7/EC1: global-error — plain HTML with own html+body; no database reads.
// Must not import globals.css or any component that might fail during a root-layout error.
import { t } from "@/messages/en";

export default function GlobalError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, sans-serif",
          background: "#fff",
          color: "#111",
        }}
      >
        {/* Minimal fixed header — no DB reads */}
        <header
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            padding: "12px 16px",
            borderBottom: "1px solid #e5e7eb",
            background: "#fff",
            zIndex: 50,
          }}
        >
          <span style={{ fontWeight: 700, color: "#E30613" }}>
            {t("global_error.heading")}
          </span>
        </header>

        <main
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            padding: "80px 16px 48px",
            textAlign: "center",
            gap: "16px",
          }}
        >
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>
            {t("error.heading")}
          </h1>
          <p style={{ color: "#6b7280" }}>{t("global_error.message")}</p>
          <button
            type="button"
            onClick={reset}
            style={{
              padding: "8px 16px",
              background: "#E30613",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            {t("global_error.reload")}
          </button>
        </main>

        {/* Minimal fixed footer — no DB reads */}
        <footer
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            padding: "8px 16px",
            borderTop: "1px solid #e5e7eb",
            background: "#fff",
            fontSize: "0.75rem",
            color: "#9ca3af",
            textAlign: "center",
          }}
        >
          {t("global_error.heading")}
        </footer>
      </body>
    </html>
  );
}
