"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArchiveIcon, ArchiveRestoreIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { archiveDocumentAction, deleteDocumentAction, restoreDocumentAction } from "@/lib/documents/actions";
import type { DocumentStatus } from "@/types/database";

export function DocumentDangerZone({ id, title, status }: { id: string; title: string; status: DocumentStatus }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const archived = status === "archived";

  function run(action: () => Promise<{ ok: boolean; error?: string }>, message: string, redirectAfter = false) {
    startTransition(async () => {
      const result = await action();

      if (!result.ok) {
        toast.error(result.error ?? "Something went wrong.");
        return;
      }

      toast.success(message);
      setConfirmArchive(false);
      setConfirmDelete(false);

      if (redirectAfter) router.push("/admin/documents");
      else router.refresh();
    });
  }

  return (
    <section className="bg-card rounded-xl border p-4 sm:p-5" aria-labelledby="manage-heading">
      <h2 id="manage-heading" className="text-sm font-semibold">
        Manage
      </h2>
      <p className="text-muted-foreground mt-1 text-sm">
        Archiving or deleting keeps the QR code resolvable — scanners see a notice rather than a broken link.
      </p>

      <div className="mt-4 flex flex-col gap-2">
        {archived ? (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => run(() => restoreDocumentAction(id), "Document restored.")}
          >
            <ArchiveRestoreIcon className="size-4" aria-hidden="true" />
            Restore document
          </Button>
        ) : (
          <Button type="button" variant="outline" disabled={pending} onClick={() => setConfirmArchive(true)}>
            <ArchiveIcon className="size-4" aria-hidden="true" />
            Archive document
          </Button>
        )}

        <Button type="button" variant="destructive" disabled={pending} onClick={() => setConfirmDelete(true)}>
          <Trash2Icon className="size-4" aria-hidden="true" />
          Delete document
        </Button>
      </div>

      <ConfirmDialog
        open={confirmArchive}
        onOpenChange={setConfirmArchive}
        title="Archive this document?"
        description={`"${title}" will stop being available to anyone scanning its QR code. You can restore it at any time.`}
        confirmLabel="Archive"
        pending={pending}
        onConfirm={() => run(() => archiveDocumentAction(id), "Document archived.")}
      />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this document?"
        description={`"${title}" will be removed from your library and its QR code will stop working. Anyone scanning it will see an "unavailable" page rather than a broken link.`}
        confirmLabel="Delete"
        destructive
        pending={pending}
        onConfirm={() => run(() => deleteDocumentAction(id), "Document deleted.", true)}
      />
    </section>
  );
}
