import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DownloadIcon } from "lucide-react";
import { getPreviewUrl, getPublicDocument } from "@/lib/documents/queries";
import { isUuid } from "@/schemas/common";
import { PublicShell } from "@/components/public/public-shell";
import { DocumentPreview } from "@/components/public/document-preview";
import { DocumentUnavailable } from "@/components/public/document-unavailable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { APP_NAME, PUBLIC_PAGES_NOINDEX, fileTypeLabel } from "@/lib/constants";
import { formatBytes, formatDate } from "@/lib/format";

const ROBOTS = PUBLIC_PAGES_NOINDEX ? { index: false, follow: false } : { index: true, follow: true };

export async function generateMetadata({ params }: PageProps<"/document/[id]">): Promise<Metadata> {
  const { id } = await params;

  if (!isUuid(id)) return { title: "Document", robots: ROBOTS };

  const result = await getPublicDocument(id);

  if (result.state === "available") {
    return {
      title: result.document.title,
      description: result.document.description || `${result.document.title} — ${APP_NAME}`,
      robots: ROBOTS,
    };
  }

  return { title: result.state === "unavailable" ? "Document unavailable" : "Document not found", robots: ROBOTS };
}

export default async function PublicDocumentPage({ params }: PageProps<"/document/[id]">) {
  const { id } = await params;

  // Cheap reject before touching the database.
  if (!isUuid(id)) notFound();

  const result = await getPublicDocument(id);

  if (result.state === "not_found") notFound();

  if (result.state === "unavailable") {
    return (
      <PublicShell>
        <DocumentUnavailable
          reason={result.reason}
          title={result.title}
          documentNumber={result.documentNumber}
          version={result.version}
        />
      </PublicShell>
    );
  }

  const document = result.document;
  const previewUrl = await getPreviewUrl(id);

  const details = [
    document.category ? { label: "Category", value: document.category } : null,
    document.version ? { label: "Version", value: document.version } : null,
    document.document_number ? { label: "Reference", value: document.document_number } : null,
    { label: "Published", value: formatDate(document.created_at) },
    { label: "File", value: `${fileTypeLabel(document.file_type)} · ${formatBytes(document.file_size)}` },
  ].filter((detail): detail is { label: string; value: string } => detail !== null);

  return (
    <PublicShell>
      <article>
        <header className="text-center">
          <h1 className="text-xl font-semibold tracking-tight text-balance sm:text-2xl">{document.title}</h1>

          {document.document_number || document.version ? (
            <p className="text-muted-foreground mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm">
              {document.document_number ? <span className="font-mono text-xs">{document.document_number}</span> : null}
              {document.version ? <span>Version {document.version}</span> : null}
            </p>
          ) : null}
        </header>

        <div className="mt-6">
          <DocumentPreview
            fileName={document.file_name}
            fileType={document.file_type}
            fileSize={document.file_size}
            previewUrl={previewUrl}
          />
        </div>

        {/* A plain link, so it survives right-click "save as", JavaScript
            being unavailable, and in-app browsers that block scripted saves. */}
        <div className="mt-6">
          <Button asChild size="lg" className="h-11 w-full text-base">
            <a href={`/api/public/documents/${document.id}/download`}>
              <DownloadIcon className="size-4" aria-hidden="true" />
              Download document
            </a>
          </Button>
        </div>

        {document.description ? (
          <section className="mt-8" aria-labelledby="about-heading">
            <h2 id="about-heading" className="text-sm font-semibold">
              About this document
            </h2>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed whitespace-pre-line">
              {document.description}
            </p>
          </section>
        ) : null}

        <section className="mt-8" aria-labelledby="details-heading">
          <h2 id="details-heading" className="text-sm font-semibold">
            Details
          </h2>
          <dl className="mt-3 divide-y rounded-xl border">
            {details.map((detail) => (
              <div key={detail.label} className="flex items-start justify-between gap-4 px-4 py-3 text-sm">
                <dt className="text-muted-foreground shrink-0">{detail.label}</dt>
                <dd className="text-right font-medium">{detail.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        {document.tags.length > 0 ? (
          <div className="mt-6 flex flex-wrap justify-center gap-1.5">
            {document.tags.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>
        ) : null}
      </article>
    </PublicShell>
  );
}
