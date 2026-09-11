import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeftIcon, DownloadIcon } from "lucide-react";
import { requireAdminPage } from "@/lib/auth/session";
import { effectiveStatus, getAdminDocument } from "@/lib/documents/queries";
import { isUuid } from "@/schemas/common";
import { PageContainer } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { FileTypeIcon } from "@/components/shared/file-type-icon";
import { DocumentEditForm } from "@/components/admin/document-edit-form";
import { DocumentDangerZone } from "@/components/admin/document-danger-zone";
import { QrCodePanel } from "@/components/admin/qr-code-panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fileTypeLabel } from "@/lib/constants";
import { formatBytes, formatDate, formatDateTime } from "@/lib/format";

export async function generateMetadata({ params }: PageProps<"/admin/documents/[id]">): Promise<Metadata> {
  const { id } = await params;
  if (!isUuid(id)) return { title: "Document" };

  const document = await getAdminDocument(id);
  return { title: document?.title ?? "Document" };
}

export default async function DocumentDetailPage({ params }: PageProps<"/admin/documents/[id]">) {
  await requireAdminPage();

  const { id } = await params;
  if (!isUuid(id)) notFound();

  const document = await getAdminDocument(id);
  if (!document) notFound();

  const status = effectiveStatus(document);

  const facts = [
    { label: "Uploaded", value: formatDateTime(document.created_at) },
    { label: "Last updated", value: formatDateTime(document.updated_at) },
    { label: "Expires", value: document.expires_at ? formatDate(document.expires_at) : "No expiry" },
  ];

  return (
    <PageContainer>
      <Button asChild variant="ghost" size="sm" className="-ml-2.5 mb-3">
        <Link href="/admin/documents">
          <ChevronLeftIcon className="size-4" aria-hidden="true" />
          Documents
        </Link>
      </Button>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-lg font-semibold tracking-tight">{document.title}</h1>
            <StatusBadge status={status} />
          </div>
          <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            {document.document_number ? <span className="font-mono text-xs">{document.document_number}</span> : null}
            {document.version ? <span>Version {document.version}</span> : null}
            {document.category ? <span>{document.category}</span> : null}
          </p>
        </div>

        <Button asChild variant="outline" className="shrink-0">
          <a href={`/api/admin/documents/${document.id}/download`}>
            <DownloadIcon className="size-4" aria-hidden="true" />
            Download file
          </a>
        </Button>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-5">
          <DocumentEditForm document={document} />
        </div>

        <div className="space-y-5">
          <section className="bg-card rounded-xl border p-4 sm:p-5" aria-labelledby="file-heading">
            <h2 id="file-heading" className="text-sm font-semibold">
              File
            </h2>
            <div className="mt-3 flex items-center gap-3 rounded-lg border p-3">
              <div className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-md">
                <FileTypeIcon mime={document.file_type} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium" title={document.file_name}>
                  {document.file_name}
                </p>
                <p className="text-muted-foreground text-xs">
                  {fileTypeLabel(document.file_type)} · {formatBytes(document.file_size)}
                </p>
              </div>
            </div>

            <dl className="mt-4 space-y-2 text-sm">
              {facts.map((fact) => (
                <div key={fact.label} className="flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground shrink-0">{fact.label}</dt>
                  <dd className="text-right">{fact.value}</dd>
                </div>
              ))}
            </dl>

            {document.tags.length > 0 ? (
              <div className="mt-4">
                <p className="text-muted-foreground mb-2 text-xs font-medium">Tags</p>
                <div className="flex flex-wrap gap-1.5">
                  {document.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          <QrCodePanel documentId={document.id} />

          <DocumentDangerZone id={document.id} title={document.title} status={status} />
        </div>
      </div>
    </PageContainer>
  );
}
