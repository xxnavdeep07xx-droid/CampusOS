"use client";

import QRCode from "react-qr-code";

/**
 * BrutalQR — render a QR code inside a thick black border with a hard shadow.
 *
 * Uses react-qr-code (an SVG renderer) so we don't need a canvas or extra
 * image assets. The SVG is reversed (white background, black foreground) for
 * maximum scan reliability.
 */
export function BrutalQR({
  value,
  size = 160,
  className,
}: {
  value: string;
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={
        "inline-block rounded-xl border-2 border-slate-900 bg-white p-3 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] " +
        (className ?? "")
      }
    >
      <QRCode value={value} size={size} bgColor="#ffffff" fgColor="#0f172a" level="M" />
    </div>
  );
}
