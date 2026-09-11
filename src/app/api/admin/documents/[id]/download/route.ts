import { NextResponse, type NextRequest } from "next/server";
import { AuthorizationError, requireAdmin } from "@/lib/auth/session";
import { getAdminDownloadTarget } from "@/lib/documents/queries";
import { createSignedUrl } from "@/lib/documents/storage";
import { SIGNED_URL_TTL } from "@/lib/constants";
import { isUuid } from "@/schemas/common";

export const runtime = "nodejs";

export async function GET(_request: NextRequest, context: RouteContext<"/api/admin/documents/[id]/download">) {
  try {
    await requireAdmin();

    const { id } = await context.params;
    if (!isUuid(id)) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const target = await getAdminDownloadTarget(id);
    if (!target) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const signedUrl = await createSignedUrl(target.filePath, SIGNED_URL_TTL.download, target.fileName);
    if (!signedUrl) {
      return NextResponse.json({ error: "This file is temporarily unavailable." }, { status: 503 });
    }

    // The redirect target is a short-lived credential; never let it be cached.
    return NextResponse.redirect(signedUrl, {
      status: 302,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: "Not authorized." }, { status: error.status });
    }
    console.error("Admin download failed", error);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
