"use client";

// Last-resort boundary for errors thrown in the ROOT layout itself. It replaces
// the whole document, so it can't rely on the app's CSS, keep styles inline.
export default function GlobalError({
  error,
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
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f8fafc",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          color: "#0f172a",
          padding: "1rem",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: "28rem" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800, margin: "0 0 0.5rem" }}>Something went wrong</h1>
          <p style={{ color: "#475569", margin: "0 0 1.5rem" }}>
            An unexpected error occurred. Please try again.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              display: "inline-flex",
              padding: "0.75rem 1.5rem",
              borderRadius: "0.75rem",
              background: "#2563eb",
              color: "#fff",
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          {error.digest && (
            <p style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "1.5rem" }}>Reference: {error.digest}</p>
          )}
        </div>
      </body>
    </html>
  );
}
