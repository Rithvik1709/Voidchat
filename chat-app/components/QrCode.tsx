"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Renders a QR code for `value`. Always dark-on-light, even in dark mode, because that is what
 * phone cameras read most reliably.
 */
export default function QrCode({ value, size = 220 }: { value: string; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Loaded on demand so the QR library is not part of the initial page weight
    import("qrcode")
      .then(({ default: QRCode }) =>
        QRCode.toCanvas(canvas, value, {
          width: size,
          margin: 2,
          errorCorrectionLevel: "M",
          color: { dark: "#0a0a0a", light: "#ffffff" },
        })
      )
      .then(() => !cancelled && setFailed(false))
      .catch(() => !cancelled && setFailed(true));

    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (failed) {
    return (
      <div className="grid place-items-center rounded-2xl border border-border p-6 text-center text-sm text-muted-foreground" style={{ width: size, height: size }}>
        Could not draw the QR code. Copy the link instead.
      </div>
    );
  }

  return (
    <canvas
      aria-label="QR code for the invite link"
      className="rounded-2xl bg-white"
      ref={canvasRef}
      role="img"
      style={{ width: size, height: size }}
    />
  );
}
