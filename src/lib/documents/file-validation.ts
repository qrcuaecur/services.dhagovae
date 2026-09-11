import "server-only";

import { fileTypeFromBuffer } from "file-type";
import { findFileType } from "@/lib/constants";
import { extensionOf } from "@/schemas/document";

const LEGACY_OFFICE_MIMES = new Set([
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
]);

const OOXML_MIMES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

/**
 * Compares what the bytes actually are against what was claimed, so a renamed
 * executable can't ride in as a "PDF".
 *
 * Container formats are the awkward case: legacy Office files are all
 * Compound File Binary and OOXML files are all zip archives, so sniffing
 * cannot distinguish a .docx from an .xlsx. For those the declared type is
 * accepted as long as the container family matches. When the sniffer can't
 * identify the bytes at all, the extension and declared MIME must agree -
 * deliberate, documented leniency rather than a silent hole.
 */
export function bytesMatchDeclaredType(
  sniffedMime: string | undefined,
  declaredMime: string,
  fileName: string
): boolean {
  const declaredType = findFileType(declaredMime);
  if (!declaredType) return false;

  if (!sniffedMime) {
    return declaredType.extensions.includes(extensionOf(fileName));
  }

  if (sniffedMime === declaredMime) return true;

  if (LEGACY_OFFICE_MIMES.has(declaredMime) && sniffedMime === "application/x-cfb") return true;

  if (OOXML_MIMES.has(declaredMime) && (sniffedMime === "application/zip" || OOXML_MIMES.has(sniffedMime))) {
    return true;
  }

  return false;
}

export async function sniffMime(head: Buffer): Promise<string | undefined> {
  const result = await fileTypeFromBuffer(head);
  return result?.mime;
}
