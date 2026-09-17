"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";

/**
 * global-error.tsx — the outermost error boundary. Catches errors thrown
 * by the root layout itself (e.g. auth provider failures, font loading
 * crashes). Replaces the entire <html><body> when it renders.
 *
 * Must include its own <html> + <body> tags since it replaces the root layout.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error boundary caught:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1rem",
          backgroundColor: "#FDFBF7",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: "28rem",
            width: "100%",
            border: "3px solid #0f172a",
            borderRadius: "0.75rem",
            background: "white",
            boxShadow: "4px 4px 0px 0px rgba(15,23,42,1)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "8px",
              background: "#f43f5e",
              borderBottom: "3px solid #0f172a",
            }}
          />
          <div style={{ padding: "1.5rem", textAlign: "center" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
                margin: "0 auto 0.75rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "0.75rem",
                border: "2px solid #0f172a",
                background: "#fecdd3",
                boxShadow: "3px 3px 0px 0px rgba(15,23,42,1)",
              }}
            >
              <AlertTriangle size={24} color="#be123c" strokeWidth={2.5} />
            </div>
            <h2
              style={{
                margin: "0 0 0.5rem",
                fontSize: "1.125rem",
                fontWeight: 900,
                textTransform: "uppercase",
                letterSpacing: "-0.01em",
                color: "#0f172a",
              }}
            >
              Application error
            </h2>
            <p
              style={{
                margin: "0 0 1rem",
                fontSize: "0.75rem",
                color: "#475569",
                fontWeight: 500,
              }}
            >
              A critical error occurred. The error has been logged — please try
              reloading the page.
            </p>
            {error.digest && (
              <p
                style={{
                  margin: "0 0 1rem",
                  fontSize: "0.625rem",
                  fontFamily: "monospace",
                  color: "#94a3b8",
                }}
              >
                Error ID: {error.digest}
              </p>
            )}
            <button
              type="button"
              onClick={() => reset()}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.375rem",
                padding: "0.5rem 1rem",
                border: "2px solid #0f172a",
                borderRadius: "0.5rem",
                background: "#0f172a",
                color: "#FDFBF7",
                fontSize: "0.75rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                cursor: "pointer",
                boxShadow: "2px 2px 0px 0px rgba(15,23,42,1)",
                transition: "all 150ms",
              }}
            >
              <RotateCw size={14} strokeWidth={2.5} />
              Reload
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
