import "server-only";

import QRCode from "qrcode";
import { publicDocumentUrl } from "@/lib/env";

/**
 * Single source of truth for QR rendering, so the code previewed on screen
 * and the file that gets downloaded and printed are always identical.
 *
 * Level M recovers ~15% of the symbol - the usual choice for print, where
 * codes get scaled, creased and smudged. L is too fragile on paper; H would
 * make the symbol denser than a short URL needs at small print sizes.
 * The 4-module quiet zone is required by the spec; scanners lose codes
 * printed flush against other artwork without it.
 */
const OPTIONS = {
  errorCorrectionLevel: "M",
  margin: 4,
  color: { dark: "#000000", light: "#ffffff" },
} as const;

/** The QR encodes the public page URL, never a storage URL. */
export function qrPayload(documentId: string): string {
  return publicDocumentUrl(documentId);
}

export async function generateQrSvg(documentId: string): Promise<string> {
  return QRCode.toString(qrPayload(documentId), { ...OPTIONS, type: "svg" });
}

export async function generateQrPng(documentId: string): Promise<Buffer> {
  // 1024px keeps it sharp when scaled up for signage or a printed label.
  return QRCode.toBuffer(qrPayload(documentId), { ...OPTIONS, type: "png", width: 1024 });
}
