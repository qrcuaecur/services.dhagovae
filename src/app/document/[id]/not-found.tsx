import Link from "next/link";
import { FileQuestionIcon } from "lucide-react";
import { PublicShell } from "@/components/public/public-shell";
import { Button } from "@/components/ui/button";

/**
 * Deliberately generic: a deleted document and an id that never existed look
 * identical here, so the page can't be used to probe which ids are real.
 */
export default function DocumentNotFound() {
  return (
    <PublicShell>
      <div className="text-center">
        <div className="bg-muted text-muted-foreground mx-auto flex size-12 items-center justify-center rounded-full">
          <FileQuestionIcon className="size-5" aria-hidden="true" />
        </div>

        <h1 className="mt-5 text-xl font-semibold tracking-tight text-balance">Document unavailable</h1>
        <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm text-balance">
          This document may have been removed, archived, or the QR code may be invalid. Please contact the administrator
          if you were expecting to find something here.
        </p>

        <Button asChild variant="outline" className="mt-6">
          <Link href="/">Go back</Link>
        </Button>
      </div>
    </PublicShell>
  );
}
