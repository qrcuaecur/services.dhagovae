import type { DocumentRow, DocumentStatus } from "@/types/database";

export type { DocumentRow, DocumentStatus };

/**
 * What the admin list/detail screens render. Storage internals are kept
 * out of anything that can reach a Client Component.
 */
export type AdminDocument = Omit<DocumentRow, "file_path" | "storage_bucket">;

/**
 * The subset safe to send to a public, unauthenticated visitor. Never
 * carries file_path or storage_bucket - Client Component props are
 * serialised into the browser-visible RSC payload.
 */
export type PublicDocument = {
  id: string;
  title: string;
  description: string;
  document_number: string | null;
  category: string | null;
  version: string | null;
  tags: string[];
  file_name: string;
  file_type: string;
  file_size: number;
  created_at: string;
};

/** Why a public page is showing something other than the document. */
export type UnavailableReason = "archived" | "expired";

export type PublicDocumentResult =
  | { state: "available"; document: PublicDocument }
  | { state: "unavailable"; reason: UnavailableReason; title: string; documentNumber: string | null; version: string | null }
  | { state: "not_found" };

export type DocumentListResult = {
  documents: AdminDocument[];
  total: number;
  page: number;
  pageCount: number;
};

export type DashboardStats = {
  total: number;
  active: number;
  archived: number;
};

/** Discriminated result for Server Actions, so expected failures don't throw. */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type DocumentFormState = {
  ok: boolean;
  error: string | null;
  fieldErrors: Record<string, string[]>;
};

/**
 * Lives here rather than beside the action: a "use server" module may only
 * export async functions, so a plain object exported from one arrives as
 * undefined on the client.
 */
export const emptyDocumentFormState: DocumentFormState = { ok: false, error: null, fieldErrors: {} };
