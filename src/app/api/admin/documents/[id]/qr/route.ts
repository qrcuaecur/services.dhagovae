import { NextResponse, type NextRequest } from "next/server";
import { AuthorizationError, requireAdmin } from "@/lib/auth/session";
import { getAdminDocument } from "@/lib/documents/queries";
import { generateQrPng, generateQrSvg } from "@/lib/qr/generate";
import { isUuid } from "@/schemas/common";
import { sanitizeFilename } from "@/lib/documents/storage";

export const runtime = "nodejs";

export async function GET(request: NextRequest, context: RouteContext<"/api/admin/documents/[id]/qr">) {
  try {
    await requireAdmin();

    const { id } = await context.params;
    if (!isUuid(id)) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const document = await getAdminDocument(id);
    if (!document) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const format = request.nextUrl.searchParams.get("format") === "png" ? "png" : "svg";
    const baseName = sanitizeFilename(`qr-${document.document_number || document.title || id}`);

    if (format === "png") {
      const png = await generateQrPng(id);
      return new NextResponse(new Uint8Array(png), {
        headers: {
          "Content-Type": "image/png",
          "Content-Disposition": `attachment; filename="${baseName}.png"`,
          "Cache-Control": "private, no-store",
        },
      });
    }

    const svg = await generateQrSvg(id);
    return new NextResponse(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Content-Disposition": `attachment; filename="${baseName}.svg"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: "Not authorized." }, { status: error.status });
    }
    console.error("QR generation failed", error);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
