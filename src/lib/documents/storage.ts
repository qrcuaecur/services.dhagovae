import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { STORAGE_BUCKET } from "@/lib/constants";
import { isUuid } from "@/schemas/common";

/**
 * Client-supplied filenames are never used as-is in a storage path.
 * Directory components are dropped first, which is what defeats traversal;
 * the rest normalises the name so keys stay predictable and printable.
 */
export function sanitizeFilename(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? "";
  const lastDot = base.lastIndexOf(".");

  const rawName = lastDot > 0 ? base.slice(0, lastDot) : base;
  const rawExtension = lastDot > 0 ? base.slice(lastDot + 1) : "";

  const extension = rawExtension.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10);

  const name = rawName
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9.\-\s_]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/\.+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 80)
    .toLowerCase();

  const safeName = name.length > 0 ? name : "document";

  return extension ? `${safeName}.${extension}` : safeName;
}

export function buildStoragePath(documentId: string, originalFileName: string): string {
  if (!isUuid(documentId)) {
    throw new Error("Refusing to build a storage path from a non-UUID document id.");
  }
  return `${documentId}/${sanitizeFilename(originalFileName)}`;
}

/**
 * The bucket is private, so this is the only way bytes reach a browser.
 * `downloadAs` sets Content-Disposition so the file saves under its original
 * name rather than the sanitised storage key.
 */
export async function createSignedUrl(
  path: string,
  expiresInSeconds: number,
  downloadAs?: string
): Promise<string | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(path, expiresInSeconds, downloadAs ? { download: downloadAs } : undefined);

  if (error || !data?.signedUrl) return null;

  return data.signedUrl;
}

/** Used to clean up an uploaded object when the metadata insert fails. */
export async function removeStorageObject(path: string): Promise<void> {
  const supabase = createAdminClient();
  await supabase.storage.from(STORAGE_BUCKET).remove([path]);
}

export type StorageObjectInfo = { size: number; mimetype: string | null };

/**
 * Reads the object's real size and type back from storage. The browser
 * uploads straight to Supabase, so nothing the client claimed about the file
 * is trusted - this is what actually landed.
 */
export async function getStorageObjectInfo(path: string): Promise<StorageObjectInfo | null> {
  const supabase = createAdminClient();

  const slash = path.lastIndexOf("/");
  const directory = slash === -1 ? "" : path.slice(0, slash);
  const fileName = slash === -1 ? path : path.slice(slash + 1);

  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).list(directory, { search: fileName });

  if (error || !data) return null;

  const match = data.find((entry) => entry.name === fileName);
  if (!match) return null;

  const metadata = match.metadata as { size?: number; mimetype?: string } | null;

  return {
    size: typeof metadata?.size === "number" ? metadata.size : 0,
    mimetype: metadata?.mimetype ?? null,
  };
}

/**
 * Pulls just the leading bytes of a stored object so its true format can be
 * sniffed. A Range request keeps this cheap even for a 50MB file.
 */
export async function readObjectHead(path: string, bytes = 4100): Promise<Buffer | null> {
  const signedUrl = await createSignedUrl(path, 60);
  if (!signedUrl) return null;

  const response = await fetch(signedUrl, { headers: { Range: `bytes=0-${bytes - 1}` } });
  if (!response.ok) return null;

  return Buffer.from(await response.arrayBuffer());
}
