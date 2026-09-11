import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeftIcon } from "lucide-react";
import { requireAdminPage } from "@/lib/auth/session";
import { DocumentUploadForm } from "@/components/admin/document-upload-form";
import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Upload document" };

export default async function NewDocumentPage() {
  await requireAdminPage();

  return (
    <PageContainer>
      <Button asChild variant="ghost" size="sm" className="-ml-2.5 mb-3">
        <Link href="/admin/documents">
          <ChevronLeftIcon className="size-4" aria-hidden="true" />
          Documents
        </Link>
      </Button>

      <PageHeader
        title="Upload document"
        description="A permanent QR code is generated as soon as the document is saved."
      />

      <div className="mt-6 max-w-2xl">
        <DocumentUploadForm />
      </div>
    </PageContainer>
  );
}
