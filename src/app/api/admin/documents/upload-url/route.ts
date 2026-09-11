import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { AuthorizationError, requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { buildStoragePath } from "@/lib/documents/storage";
import { validateFileMeta } from "@/schemas/document";
import { STORAGE_BUCKET } from "@/lib/constants";

export const runtime = "nodejs";

/**
 * Step one of the upload. Hands the browser a short-lived signed URL so the
 * file goes straight to Supabase Storage rather than through this server -
 * serverless platforms (Vercel among them) cap request bodies at a few
 * megabytes, which a scanned PDF exceeds routinely.
 *
 * Nothing is written to the database here. The document row is only created
 * in step two, after the bytes have actually landed and been inspected.
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const body = (await request.json()) as { fileName?: unknown; fileSize?: unknown; fileType?: unknown };

    const fileName = typeof body.fileName === "string" ? body.fileName : "";
    const fileSize = typeof body.fileSize === "number" ? body.fileSize : 0;
    const fileType = typeof body.fileType === "string" ? body.fileType : "";

    const problem = validateFileMeta({ name: fileName, size: fileSize, type: fileType });
    if (problem) {
      return NextResponse.json({ error: problem.message }, { status: 400 });
    }

    // The id is minted here because it forms the storage path and becomes the
    // permanent QR identifier.
    const id = randomUUID();
    const path = buildStoragePath(id, fileName);

    const supabase = await createClient();

    // Signed with the admin's own session, so the storage RLS policy is
    // genuinely exercised rather than bypassed with the service role.
    const { data, error } = await supabase.storage.from(STORAGE_BUCKET).createSignedUploadUrl(path);

    if (error || !data) {
      console.error("Could not create signed upload URL", error?.message);
      return NextResponse.json({ error: "We couldn't start this upload. Try again." }, { status: 500 });
    }

    return NextResponse.json({ id, path, signedUrl: data.signedUrl }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: "Not authorized." }, { status: error.status });
    }

    console.error("Unexpected upload-url error", error);
    return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
  }
}
