import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { AuthorizationError, requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  buildStoragePath,
  getStorageObjectInfo,
  readObjectHead,
  removeStorageObject,
} from "@/lib/documents/storage";
import { bytesMatchDeclaredType, sniffMime } from "@/lib/documents/file-validation";
import { documentUploadSchema, validateFileMeta } from "@/schemas/document";
import { STORAGE_BUCKET } from "@/lib/constants";
import { isUuid } from "@/schemas/common";

export const runtime = "nodejs";

/**
 * Step two of the upload: the bytes are already in storage, this creates the
 * document row.
 *
 * Nothing the client sends about the file is taken on trust. The storage path
 * is re-derived from the id server-side, the object is confirmed to exist, its
 * size and type are read back from storage, and its leading bytes are sniffed
 * to catch a file that was renamed to look like something it isn't. Any
 * failure removes the orphaned object.
 */
export async function POST(request: NextRequest) {
  let storagePath: string | null = null;

  try {
    const session = await requireAdmin();

    const body = (await request.json()) as Record<string, unknown>;

    const id = typeof body.id === "string" ? body.id : "";
    const fileName = typeof body.fileName === "string" ? body.fileName : "";
    const declaredType = typeof body.fileType === "string" ? body.fileType : "";

    if (!isUuid(id)) {
      return NextResponse.json({ error: "That upload reference isn't valid." }, { status: 400 });
    }

    // Re-derived, never taken from the request: a client can't point this at
    // an object belonging to a different document.
    storagePath = buildStoragePath(id, fileName);

    const parsed = documentUploadSchema.safeParse({
      title: body.title ?? "",
      description: body.description ?? "",
      document_number: body.document_number ?? "",
      category: body.category ?? "",
      version: body.version ?? "",
      tags: body.tags ?? "",
      expires_at: body.expires_at ?? "",
    });

    if (!parsed.success) {
      await removeStorageObject(storagePath).catch(() => undefined);
      return NextResponse.json(
        { error: "Check the highlighted fields and try again.", fieldErrors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const info = await getStorageObjectInfo(storagePath);

    if (!info) {
      return NextResponse.json({ error: "The uploaded file didn't arrive. Try again." }, { status: 400 });
    }

    // Size comes from storage, not from what the browser claimed.
    const sizeProblem = validateFileMeta({ name: fileName, size: info.size, type: declaredType });
    if (sizeProblem) {
      await removeStorageObject(storagePath).catch(() => undefined);
      return NextResponse.json({ error: sizeProblem.message }, { status: 400 });
    }

    const head = await readObjectHead(storagePath);

    if (!head) {
      await removeStorageObject(storagePath).catch(() => undefined);
      return NextResponse.json({ error: "We couldn't verify that file. Try again." }, { status: 400 });
    }

    const sniffed = await sniffMime(head);

    if (!bytesMatchDeclaredType(sniffed, declaredType, fileName)) {
      await removeStorageObject(storagePath).catch(() => undefined);
      return NextResponse.json(
        { error: "That file's contents don't match its type. Re-save it and try again." },
        { status: 400 }
      );
    }

    const values = parsed.data;
    const supabase = await createClient();

    const { error: insertError } = await supabase.from("documents").insert({
      id,
      title: values.title,
      description: values.description,
      document_number: values.document_number,
      category: values.category,
      version: values.version,
      tags: values.tags,
      expires_at: values.expires_at ? new Date(values.expires_at).toISOString() : null,
      status: "active",
      file_name: fileName.slice(0, 255),
      file_path: storagePath,
      file_type: declaredType,
      file_size: info.size,
      storage_bucket: STORAGE_BUCKET,
      created_by: session.userId,
      deleted_at: null,
    });

    if (insertError) {
      await removeStorageObject(storagePath).catch(() => undefined);
      console.error("Document insert failed", insertError.message);
      return NextResponse.json({ error: "We couldn't save this document. Try again." }, { status: 500 });
    }

    revalidatePath("/admin/documents");
    revalidatePath("/admin/dashboard");

    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: "Not authorized." }, { status: error.status });
    }

    if (storagePath) await removeStorageObject(storagePath).catch(() => undefined);

    console.error("Unexpected upload error", error);
    return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
  }
}
