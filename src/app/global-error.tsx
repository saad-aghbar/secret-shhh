"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  retry?: () => void;
  reset?: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          background: "#f3efe8",
          color: "#2a2622",
          fontFamily: "Nunito, ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <div style={{ textAlign: "center", padding: "1.5rem" }}>
          <h1 style={{ fontSize: "1.25rem", margin: 0 }}>Something went wrong</h1>
          <p style={{ margin: "0.75rem 0 0", color: "#5c574f" }}>Try again, or go back to Chat.</p>
          <div
            style={{
              marginTop: "1.25rem",
              display: "flex",
              gap: "0.75rem",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={() => reset?.()}
              style={{
                minHeight: "2.75rem",
                border: 0,
                borderRadius: 999,
                padding: "0 1.25rem",
                background: "#4a756c",
                color: "#fffdf9",
                fontWeight: 600,
              }}
            >
              Try again
            </button>
            <a
              href="/chat"
              style={{
                minHeight: "2.75rem",
                display: "inline-flex",
                alignItems: "center",
                padding: "0 1.25rem",
                color: "#4a756c",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Go to Chat
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
