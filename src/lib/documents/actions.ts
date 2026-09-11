"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { AuthorizationError, requireAdmin } from "@/lib/auth/session";
import { documentUpdateSchema } from "@/schemas/document";
import { isUuid } from "@/schemas/common";
import type { ActionResult, DocumentFormState } from "@/types/document";

/**
 * Every mutation re-checks authorization here, independent of any UI or proxy
 * gate - a Server Action is a public endpoint.
 */
async function guard(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireAdmin();
    return { ok: true };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return {
        ok: false,
        error: error.status === 401 ? "Your session has expired. Sign in again." : "You don't have access to do that.",
      };
    }
    throw error;
  }
}

function revalidateDocument(id: string) {
  revalidatePath("/admin/documents");
  revalidatePath("/admin/dashboard");
  revalidatePath(`/admin/documents/${id}`);
  revalidatePath(`/document/${id}`);
}

export async function updateDocumentAction(
  id: string,
  _previous: DocumentFormState,
  formData: FormData
): Promise<DocumentFormState> {
  const authorized = await guard();
  if (!authorized.ok) return { ok: false, error: authorized.error, fieldErrors: {} };

  if (!isUuid(id)) return { ok: false, error: "That document reference isn't valid.", fieldErrors: {} };

  const parsed = documentUpdateSchema.safeParse({
    title: formData.get("title") ?? "",
    description: formData.get("description") ?? "",
    document_number: formData.get("document_number") ?? "",
    category: formData.get("category") ?? "",
    version: formData.get("version") ?? "",
    tags: formData.get("tags") ?? "",
    expires_at: formData.get("expires_at") ?? "",
    status: formData.get("status") ?? "active",
  });

  if (!parsed.success) {
    const flattened = parsed.error.flatten();
    return {
      ok: false,
      error: "Check the highlighted fields and try again.",
      fieldErrors: flattened.fieldErrors as Record<string, string[]>,
    };
  }

  const values = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase
    .from("documents")
    .update({
      title: values.title,
      description: values.description,
      document_number: values.document_number,
      category: values.category,
      version: values.version,
      tags: values.tags,
      status: values.status,
      expires_at: values.expires_at ? new Date(values.expires_at).toISOString() : null,
    })
    .eq("id", id)
    .is("deleted_at", null);

  if (error) {
    return { ok: false, error: "We couldn't save those changes. Try again.", fieldErrors: {} };
  }

  revalidateDocument(id);

  return { ok: true, error: null, fieldErrors: {} };
}

async function setStatus(id: string, status: "active" | "archived"): Promise<ActionResult> {
  const authorized = await guard();
  if (!authorized.ok) return { ok: false, error: authorized.error };

  if (!isUuid(id)) return { ok: false, error: "That document reference isn't valid." };

  const supabase = await createClient();
  const { error } = await supabase.from("documents").update({ status }).eq("id", id).is("deleted_at", null);

  if (error) return { ok: false, error: "We couldn't update that document. Try again." };

  revalidateDocument(id);
  return { ok: true, data: undefined };
}

export async function archiveDocumentAction(id: string): Promise<ActionResult> {
  return setStatus(id, "archived");
}

export async function restoreDocumentAction(id: string): Promise<ActionResult> {
  return setStatus(id, "active");
}

/**
 * Soft delete. The QR code keeps resolving - to a controlled "unavailable"
 * page rather than a broken link - and the row stays recoverable in the
 * database. The stored file is intentionally left in place in v1.
 */
export async function deleteDocumentAction(id: string): Promise<ActionResult> {
  const authorized = await guard();
  if (!authorized.ok) return { ok: false, error: authorized.error };

  if (!isUuid(id)) return { ok: false, error: "That document reference isn't valid." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("documents")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null);

  if (error) return { ok: false, error: "We couldn't delete that document. Try again." };

  revalidateDocument(id);
  return { ok: true, data: undefined };
}
