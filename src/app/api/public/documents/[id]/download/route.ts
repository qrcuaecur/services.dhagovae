import { NextResponse, type NextRequest } from "next/server";
import { getDownloadTarget } from "@/lib/documents/queries";
import { createSignedUrl } from "@/lib/documents/storage";
import { clientIpFrom, downloadRateLimiter } from "@/lib/rate-limit/memory";
import { SIGNED_URL_TTL } from "@/lib/constants";
import { isUuid } from "@/schemas/common";

export const runtime = "nodejs";

/**
 * Public, unauthenticated download. The bucket itself stays private - this
 * mints a short-lived signed URL and redirects to it, so the storage path is
 * never exposed and access can be revoked by archiving the document.
 */
export async function GET(request: NextRequest, context: RouteContext<"/api/public/documents/[id]/download">) {
  const limit = downloadRateLimiter.check(clientIpFrom(request.headers));

  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const { id } = await context.params;

  // Reject malformed ids before spending a database round trip on them.
  // Bouncing to the document page keeps the URL the visitor scanned intact
  // and lets that page render the friendly "unavailable" state.
  if (!isUuid(id)) {
    return NextResponse.redirect(new URL(`/document/${encodeURIComponent(id)}`, request.nextUrl.origin), 302);
  }

  // Re-read now: the document may have been archived, expired or deleted
  // since the page the visitor is looking at was rendered.
  const target = await getDownloadTarget(id);

  if (!target) {
    return NextResponse.redirect(new URL(`/document/${id}`, request.nextUrl.origin), 302);
  }

  const signedUrl = await createSignedUrl(target.filePath, SIGNED_URL_TTL.download, target.fileName);

  if (!signedUrl) {
    return NextResponse.redirect(new URL(`/document/${id}`, request.nextUrl.origin), 302);
  }

  return NextResponse.redirect(signedUrl, {
    status: 302,
    headers: { "Cache-Control": "private, no-store" },
  });
}
