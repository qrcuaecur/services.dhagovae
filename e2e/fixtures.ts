import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@example.com";
export const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "local-test-passphrase-2026";

const dir = mkdtempSync(join(tmpdir(), "qr-portal-e2e-"));

/** A small but structurally valid PDF, so magic-byte sniffing sees a real one. */
export function makePdf(name = "safety-report.pdf"): string {
  const objects = [
    "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj",
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj",
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]/Contents 4 0 R>>endobj",
    "4 0 obj<</Length 44>>stream\nBT /F1 12 Tf 20 100 Td (Safety Report) Tj ET\nendstream endobj",
  ];

  const body = `%PDF-1.4\n${objects.join("\n")}\ntrailer<</Root 1 0 R/Size 5>>\n%%EOF\n`;
  const path = join(dir, name);
  writeFileSync(path, body, "latin1");
  return path;
}

/** An executable that has been renamed to .pdf - the spoofing case. */
export function makeSpoofedPdf(name = "not-really.pdf"): string {
  const path = join(dir, name);
  // MZ header: a Windows executable, definitely not a PDF.
  writeFileSync(path, Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, ...Array(600).fill(0x41)]));
  return path;
}
