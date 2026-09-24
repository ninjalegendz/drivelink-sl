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
          background: "#f6f8fb",
          fontFamily: "Poppins, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          color: "#080f24",
          padding: "1rem",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: "26rem" }}>
          <span
            aria-hidden="true"
            style={{
              display: "grid",
              placeItems: "center",
              width: "5rem",
              height: "5rem",
              margin: "0 auto",
              borderRadius: "1.5rem",
              background: "linear-gradient(to bottom, #ffffff, #fef3e0)",
              boxShadow: "0 1px 2px 0 rgb(8 15 36 / 0.06)",
            }}
          >
            <span style={{ fontSize: "2rem", lineHeight: 1, color: "#d97706" }}>!</span>
          </span>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600, letterSpacing: "-0.01em", margin: "1.5rem 0 0.5rem" }}>
            Something went wrong
          </h1>
          <p style={{ color: "#66728a", fontSize: "0.9375rem", margin: "0 0 1.5rem" }}>
            An unexpected error occurred. Please try again.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              display: "inline-flex",
              minHeight: "3rem",
              alignItems: "center",
              padding: "0 1.5rem",
              borderRadius: "0.75rem",
              background: "#006bfe",
              color: "#fff",
              fontWeight: 600,
              fontSize: "0.9375rem",
              fontFamily: "inherit",
              border: "none",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          {error.digest && (
            <p style={{ fontSize: "0.75rem", color: "#98a3b7", marginTop: "1.5rem" }}>Reference: {error.digest}</p>
          )}
        </div>
      </body>
    </html>
  );
}
