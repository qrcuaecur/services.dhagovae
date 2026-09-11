import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon, FileTextIcon, PlusIcon, SearchIcon } from "lucide-react";
import { requireAdminPage } from "@/lib/auth/session";
import { effectiveStatus, getCategories, listDocuments } from "@/lib/documents/queries";
import { parseDocumentListParams } from "@/schemas/common";
import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { DocumentsToolbar } from "@/components/admin/documents-toolbar";
import { DocumentRowActions } from "@/components/admin/document-row-actions";
import { StatusBadge } from "@/components/shared/status-badge";
import { FileTypeIcon } from "@/components/shared/file-type-icon";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Documents" };

type RawParams = Record<string, string | string[] | undefined>;

function buildQuery(raw: RawParams, changes: Record<string, string | null>) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(raw)) {
    const single = Array.isArray(value) ? value[0] : value;
    if (single) params.set(key, single);
  }

  for (const [key, value] of Object.entries(changes)) {
    if (value === null) params.delete(key);
    else params.set(key, value);
  }

  const query = params.toString();
  return query ? `/admin/documents?${query}` : "/admin/documents";
}

/** Sorting is plain links, so it works without client JS. */
function SortLink({
  raw,
  column,
  label,
  activeSort,
  activeDirection,
}: {
  raw: RawParams;
  column: "title" | "created_at";
  label: string;
  activeSort: string;
  activeDirection: string;
}) {
  const isActive = activeSort === column;
  const nextDirection = isActive && activeDirection === "desc" ? "asc" : "desc";

  return (
    <Link
      href={buildQuery(raw, { sort: column, direction: nextDirection, page: null })}
      className="hover:text-foreground inline-flex items-center gap-1 transition-colors"
      aria-label={`Sort by ${label}`}
    >
      {label}
      <span aria-hidden="true" className="text-muted-foreground text-xs">
        {isActive ? (activeDirection === "asc" ? "↑" : "↓") : ""}
      </span>
    </Link>
  );
}

export default async function DocumentsPage({ searchParams }: PageProps<"/admin/documents">) {
  await requireAdminPage();

  const raw = (await searchParams) as RawParams;
  const params = parseDocumentListParams(raw);

  const [result, categories] = await Promise.all([listDocuments(params), getCategories()]);

  const hasFilters = Boolean(params.q || params.category || params.status);

  return (
    <PageContainer>
      <PageHeader
        title="Documents"
        description="Search, filter and manage every document in the portal."
        action={
          <Button asChild size="lg">
            <Link href="/admin/documents/new">
              <PlusIcon className="size-4" aria-hidden="true" />
              Upload document
            </Link>
          </Button>
        }
      />

      <div className="mt-6">
        <DocumentsToolbar categories={categories} />
      </div>

      <div className="bg-card mt-4 overflow-hidden rounded-xl border">
        {result.documents.length === 0 ? (
          hasFilters ? (
            <EmptyState
              icon={<SearchIcon className="size-5" />}
              title="No matching documents"
              description="Nothing matches these filters. Try a different search term or clear the filters."
              action={
                <Button asChild variant="outline">
                  <Link href="/admin/documents">Clear filters</Link>
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<FileTextIcon className="size-5" />}
              title="No documents yet"
              description="Upload your first document to generate a QR code and make it accessible instantly."
              action={
                <Button asChild>
                  <Link href="/admin/documents/new">
                    <PlusIcon className="size-4" aria-hidden="true" />
                    Upload document
                  </Link>
                </Button>
              }
            />
          )
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <SortLink
                      raw={raw}
                      column="title"
                      label="Document"
                      activeSort={params.sort}
                      activeDirection={params.direction}
                    />
                  </TableHead>
                  <TableHead className="hidden md:table-cell">Reference</TableHead>
                  <TableHead className="hidden lg:table-cell">Category</TableHead>
                  <TableHead className="hidden lg:table-cell">Version</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden sm:table-cell">
                    <SortLink
                      raw={raw}
                      column="created_at"
                      label="Uploaded"
                      activeSort={params.sort}
                      activeDirection={params.direction}
                    />
                  </TableHead>
                  <TableHead className="w-10">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.documents.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="max-w-[16rem]">
                      <Link
                        href={`/admin/documents/${doc.id}`}
                        className="flex items-center gap-2 font-medium hover:underline"
                      >
                        <FileTypeIcon mime={doc.file_type} className="text-muted-foreground shrink-0" />
                        <span className="truncate">{doc.title}</span>
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden font-mono text-xs md:table-cell">
                      {doc.document_number ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden lg:table-cell">{doc.category ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground hidden lg:table-cell">{doc.version ?? "—"}</TableCell>
                    <TableCell>
                      <StatusBadge status={effectiveStatus(doc)} />
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden whitespace-nowrap sm:table-cell">
                      {formatDate(doc.created_at)}
                    </TableCell>
                    <TableCell>
                      <DocumentRowActions id={doc.id} title={doc.title} status={effectiveStatus(doc)} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {result.pageCount > 1 ? (
        <nav className="mt-4 flex items-center justify-between" aria-label="Pagination">
          <p className="text-muted-foreground text-sm">
            Page {result.page} of {result.pageCount} · {result.total} document{result.total === 1 ? "" : "s"}
          </p>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm" disabled={result.page <= 1}>
              <Link
                href={buildQuery(raw, { page: String(Math.max(1, result.page - 1)) })}
                aria-disabled={result.page <= 1}
                className={result.page <= 1 ? "pointer-events-none opacity-50" : undefined}
              >
                <ChevronLeftIcon className="size-4" aria-hidden="true" />
                Previous
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link
                href={buildQuery(raw, { page: String(Math.min(result.pageCount, result.page + 1)) })}
                aria-disabled={result.page >= result.pageCount}
                className={result.page >= result.pageCount ? "pointer-events-none opacity-50" : undefined}
              >
                Next
                <ChevronRightIcon className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </nav>
      ) : null}
    </PageContainer>
  );
}
