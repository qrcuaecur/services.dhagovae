import type { Metadata } from "next";
import Link from "next/link";
import { FileTextIcon, PlusIcon } from "lucide-react";
import { requireAdminPage } from "@/lib/auth/session";
import { effectiveStatus, getDashboardStats, getRecentDocuments } from "@/lib/documents/queries";
import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { FileTypeIcon } from "@/components/shared/file-type-icon";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  await requireAdminPage();

  const [stats, recent] = await Promise.all([getDashboardStats(), getRecentDocuments(5)]);

  const cards = [
    { label: "Documents", value: stats.total },
    { label: "Active", value: stats.active },
    { label: "Archived", value: stats.archived },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Dashboard"
        description="Upload documents and share them by QR code."
        action={
          <Button asChild size="lg">
            <Link href="/admin/documents/new">
              <PlusIcon className="size-4" aria-hidden="true" />
              Upload document
            </Link>
          </Button>
        }
      />

      <dl className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {cards.map((card) => (
          <div key={card.label} className="bg-card rounded-xl border p-4">
            <dt className="text-muted-foreground text-sm">{card.label}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums">{card.value}</dd>
          </div>
        ))}
      </dl>

      <section className="mt-8" aria-labelledby="recent-heading">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="recent-heading" className="text-sm font-semibold">
            Recent documents
          </h2>
          {recent.length > 0 ? (
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin/documents">View all</Link>
            </Button>
          ) : null}
        </div>

        <div className="bg-card overflow-hidden rounded-xl border">
          {recent.length === 0 ? (
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
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Document</TableHead>
                    <TableHead className="hidden sm:table-cell">Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden sm:table-cell">Uploaded</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recent.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell>
                        <Link
                          href={`/admin/documents/${doc.id}`}
                          className="flex items-center gap-2 font-medium hover:underline"
                        >
                          <FileTypeIcon mime={doc.file_type} className="text-muted-foreground shrink-0" />
                          <span className="truncate">{doc.title}</span>
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden sm:table-cell">
                        {doc.category ?? "—"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={effectiveStatus(doc)} />
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden sm:table-cell">
                        {formatDate(doc.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </section>
    </PageContainer>
  );
}
