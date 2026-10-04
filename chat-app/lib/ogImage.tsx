import { ImageResponse } from "next/og";
import { OG_ALT as ALT, SITE } from "@/lib/site";

export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_ALT = ALT;

const chips = ["No sign-up", "One-time links", "Burn mode"];

/** The 1200x630 card shown when the site is shared (Open Graph / X / Slack / WhatsApp). */
export function renderOgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0a0a0a",
          color: "#fafafa",
          padding: "72px 80px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <svg width="132" height="132" viewBox="0 0 64 64">
            <path fill="#fafafa" d="M32 10.5a21.5 21.5 0 1 1-10.6 40.2L12.5 54l3.6-8.6A21.5 21.5 0 0 1 32 10.5Z" />
            <circle cx="32" cy="32" r="7.5" fill="#0a0a0a" />
          </svg>
          <div style={{ display: "flex", fontSize: 112, fontWeight: 700, letterSpacing: -5 }}>{SITE.name}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", fontSize: 68, fontWeight: 700, letterSpacing: -2, lineHeight: 1.05 }}>
            Talk freely. Leave nothing behind.
          </div>
          <div style={{ display: "flex", fontSize: 34, color: "#a3a3a3" }}>
            Anonymous group chat. No accounts. No history.
          </div>
        </div>

        <div style={{ display: "flex", gap: 16 }}>
          {chips.map(label => (
            <div
              key={label}
              style={{
                display: "flex",
                fontSize: 28,
                padding: "10px 26px",
                border: "2px solid #3a3a3a",
                borderRadius: 999,
                color: "#d4d4d4",
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...OG_SIZE }
  );
}
