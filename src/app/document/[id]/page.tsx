import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getInlineFileUrl, getPublicDocument } from "@/lib/documents/queries";
import { isUuid } from "@/schemas/common";
import { DocumentUnavailable } from "@/components/public/document-unavailable";
import { PUBLIC_PAGES_NOINDEX } from "@/lib/constants";

const ROBOTS = PUBLIC_PAGES_NOINDEX ? { index: false, follow: false } : { index: true, follow: true };

export async function generateMetadata({ params }: PageProps<"/document/[id]">): Promise<Metadata> {
  const { id } = await params;

  if (!isUuid(id)) return { title: "Document", robots: ROBOTS };

  const result = await getPublicDocument(id);

  if (result.state === "available") {
    return { title: result.document.title, robots: ROBOTS };
  }

  return { title: result.state === "unavailable" ? "Document unavailable" : "Document not found", robots: ROBOTS };
}

/**
 * A QR scan lands here and sees only the document itself - no header, logo,
 * title, buttons or footer. The visitor is redirected straight to a
 * short-lived inline signed URL, so the browser renders the file exactly as it
 * is (PDFs and images inline; other formats download). The QR still encodes
 * this stable /document/[id] address, so the redirect target can change
 * without reprinting anything.
 */
export default async function PublicDocumentPage({ params }: PageProps<"/document/[id]">) {
  const { id } = await params;

  // Cheap reject before touching the database.
  if (!isUuid(id)) notFound();

  const result = await getPublicDocument(id);

  if (result.state === "not_found") notFound();

  // Archived or expired: there is no file to show, so this is the one case
  // that renders a message instead - kept minimal, no branding.
  if (result.state === "unavailable") {
    return (
      <main className="flex min-h-svh items-center justify-center px-4 py-12">
        <DocumentUnavailable
          reason={result.reason}
          title={result.title}
          documentNumber={result.documentNumber}
          version={result.version}
        />
      </main>
    );
  }

  const url = await getInlineFileUrl(id);

  // Signing can fail if the document changed between the two reads above.
  if (!url) notFound();

  redirect(url);
}
