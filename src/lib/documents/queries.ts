import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/session";
import { DOCUMENTS_PER_PAGE, SIGNED_URL_TTL, previewKindFor } from "@/lib/constants";
import { createSignedUrl } from "@/lib/documents/storage";
import type { DocumentListParams } from "@/schemas/common";
import type {
  AdminDocument,
  DashboardStats,
  DocumentListResult,
  PublicDocument,
  PublicDocumentResult,
} from "@/types/document";
import type { DocumentRow, DocumentStatus } from "@/types/database";

/** Columns safe to hand to admin UI: no storage internals. */
const ADMIN_COLUMNS =
  "id, title, description, document_number, category, tags, version, file_name, file_type, file_size, status, expires_at, deleted_at, created_by, created_at, updated_at";

/** Columns safe to hand to an anonymous visitor. */
const PUBLIC_COLUMNS =
  "id, title, description, document_number, category, tags, version, file_name, file_type, file_size, status, expires_at, deleted_at, created_at";

/**
 * Expiry is derived from expires_at rather than stored, so it is always
 * accurate without a scheduled job. status='expired' remains available as a
 * manual override. Archived wins over expired: it's the deliberate action.
 */
export function effectiveStatus(doc: { status: DocumentStatus; expires_at: string | null }): DocumentStatus {
  if (doc.status === "archived") return "archived";
  if (doc.status === "expired") return "expired";
  if (doc.expires_at && new Date(doc.expires_at).getTime() < Date.now()) return "expired";
  return "active";
}

export async function listDocuments(params: DocumentListParams): Promise<DocumentListResult> {
  await requireAdmin();

  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  let query = supabase
    .from("documents")
    .select(ADMIN_COLUMNS, { count: "exact" })
    .is("deleted_at", null);

  if (params.q) {
    // params.q is stripped of PostgREST metacharacters by sanitizeSearchTerm.
    const term = `%${params.q}%`;
    query = query.or(
      `title.ilike.${term},document_number.ilike.${term},category.ilike.${term},file_name.ilike.${term}`
    );
  }

  if (params.category) {
    query = query.eq("category", params.category);
  }

  if (params.status === "archived") {
    query = query.eq("status", "archived");
  } else if (params.status === "expired") {
    query = query.neq("status", "archived").or(`status.eq.expired,expires_at.lt.${nowIso}`);
  } else if (params.status === "active") {
    query = query.eq("status", "active").or(`expires_at.is.null,expires_at.gte.${nowIso}`);
  }

  const from = (params.page - 1) * DOCUMENTS_PER_PAGE;

  const { data, count, error } = await query
    .order(params.sort, { ascending: params.direction === "asc" })
    .range(from, from + DOCUMENTS_PER_PAGE - 1);

  if (error) {
    throw new Error("Unable to load documents.");
  }

  const total = count ?? 0;

  return {
    documents: (data ?? []) as AdminDocument[],
    total,
    page: params.page,
    pageCount: Math.max(1, Math.ceil(total / DOCUMENTS_PER_PAGE)),
  };
}

export const getAdminDocument = cache(async (id: string): Promise<AdminDocument | null> => {
  await requireAdmin();

  const supabase = await createClient();
  const { data } = await supabase
    .from("documents")
    .select(ADMIN_COLUMNS)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  return (data as AdminDocument | null) ?? null;
});

export async function getDashboardStats(): Promise<DashboardStats> {
  await requireAdmin();

  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const liveCount = () => supabase.from("documents").select("id", { count: "exact", head: true }).is("deleted_at", null);

  const [total, active, archived] = await Promise.all([
    liveCount(),
    liveCount().eq("status", "active").or(`expires_at.is.null,expires_at.gte.${nowIso}`),
    liveCount().eq("status", "archived"),
  ]);

  return {
    total: total.count ?? 0,
    active: active.count ?? 0,
    archived: archived.count ?? 0,
  };
}

export async function getRecentDocuments(limit = 5): Promise<AdminDocument[]> {
  await requireAdmin();

  const supabase = await createClient();
  const { data } = await supabase
    .from("documents")
    .select(ADMIN_COLUMNS)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []) as AdminDocument[];
}

export async function getCategories(): Promise<string[]> {
  await requireAdmin();

  const supabase = await createClient();
  const { data } = await supabase
    .from("documents")
    .select("category")
    .is("deleted_at", null)
    .not("category", "is", null)
    .limit(1000);

  const categories = (data ?? [])
    .map((row) => (row as { category: string | null }).category)
    .filter((category): category is string => Boolean(category));

  return Array.from(new Set(categories)).sort((a, b) => a.localeCompare(b));
}

// ---------------------------------------------------------------------------
// Public reads
//
// These use the service-role client because `anon` has no policies on
// documents at all. That is deliberate: a row-filtering policy can only make
// a row appear or vanish, which collapses "never existed", "archived" and
// "expired" into one empty result, and the public page has to tell them
// apart. Keeping the bypass in one narrow, column-allowlisted function is
// easier to audit than a permissive policy, and it fails closed if anyone
// later wires the public page to the anon client by mistake.
// ---------------------------------------------------------------------------

type PublicRow = Pick<
  DocumentRow,
  | "id"
  | "title"
  | "description"
  | "document_number"
  | "category"
  | "tags"
  | "version"
  | "file_name"
  | "file_type"
  | "file_size"
  | "status"
  | "expires_at"
  | "deleted_at"
  | "created_at"
>;

function toPublicDocument(row: PublicRow): PublicDocument {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    document_number: row.document_number,
    category: row.category,
    version: row.version,
    tags: row.tags,
    file_name: row.file_name,
    file_type: row.file_type,
    file_size: row.file_size,
    created_at: row.created_at,
  };
}

export const getPublicDocument = cache(async (id: string): Promise<PublicDocumentResult> => {
  const supabase = createAdminClient();

  const { data } = await supabase.from("documents").select(PUBLIC_COLUMNS).eq("id", id).maybeSingle();

  const row = data as PublicRow | null;

  // Soft-deleted documents are indistinguishable from ones that never
  // existed - nothing to learn from probing ids.
  if (!row || row.deleted_at) return { state: "not_found" };

  const status = effectiveStatus(row);

  if (status !== "active") {
    return {
      state: "unavailable",
      reason: status === "archived" ? "archived" : "expired",
      title: row.title,
      documentNumber: row.document_number,
      version: row.version,
    };
  }

  return { state: "available", document: toPublicDocument(row) };
});

export type DownloadTarget = {
  filePath: string;
  fileName: string;
  fileType: string;
};

/**
 * Re-read at click time, never trusted from the rendered page: a document can
 * be archived or expire between page load and pressing Download.
 */
export async function getDownloadTarget(id: string): Promise<DownloadTarget | null> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("documents")
    .select("id, file_path, file_name, file_type, status, expires_at, deleted_at")
    .eq("id", id)
    .maybeSingle();

  if (!data) return null;

  const row = data as Pick<DocumentRow, "file_path" | "file_name" | "file_type" | "status" | "expires_at" | "deleted_at">;

  if (row.deleted_at) return null;
  if (effectiveStatus(row) !== "active") return null;

  return { filePath: row.file_path, fileName: row.file_name, fileType: row.file_type };
}

/**
 * Signed URL for an inline preview. Longer-lived than the download link
 * because a viewer may sit reading it, but still short and single-purpose -
 * which is why passing this string to a Client Component is acceptable when
 * passing the raw storage path never would be.
 */
export async function getPreviewUrl(id: string): Promise<string | null> {
  const target = await getDownloadTarget(id);
  if (!target) return null;

  const kind = previewKindFor(target.fileType);
  if (kind === "generic") return null;

  return createSignedUrl(target.filePath, SIGNED_URL_TTL.preview);
}

/** Admin-side file reference, for the admin download action. */
export async function getAdminDownloadTarget(id: string): Promise<DownloadTarget | null> {
  await requireAdmin();

  const supabase = await createClient();
  const { data } = await supabase
    .from("documents")
    .select("file_path, file_name, file_type")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!data) return null;

  const row = data as Pick<DocumentRow, "file_path" | "file_name" | "file_type">;
  return { filePath: row.file_path, fileName: row.file_name, fileType: row.file_type };
}
