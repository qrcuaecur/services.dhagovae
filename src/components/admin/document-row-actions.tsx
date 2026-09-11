"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  DownloadIcon,
  EllipsisIcon,
  EyeIcon,
  PencilIcon,
  QrCodeIcon,
  Trash2Icon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { archiveDocumentAction, deleteDocumentAction, restoreDocumentAction } from "@/lib/documents/actions";
import type { DocumentStatus } from "@/types/database";

export function DocumentRowActions({
  id,
  title,
  status,
  onDeleted,
}: {
  id: string;
  title: string;
  status: DocumentStatus;
  onDeleted?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const archived = status === "archived";

  function run(action: () => Promise<{ ok: boolean; error?: string }>, successMessage: string, onDone?: () => void) {
    startTransition(async () => {
      const result = await action();

      if (!result.ok) {
        toast.error(result.error ?? "Something went wrong.");
        return;
      }

      toast.success(successMessage);
      setConfirmArchive(false);
      setConfirmDelete(false);
      router.refresh();
      onDone?.();
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${title}`}>
            <EllipsisIcon className="size-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem asChild>
            <Link href={`/admin/documents/${id}`}>
              <EyeIcon className="size-4" aria-hidden="true" />
              View
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/admin/documents/${id}#edit`}>
              <PencilIcon className="size-4" aria-hidden="true" />
              Edit
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/admin/documents/${id}#qr`}>
              <QrCodeIcon className="size-4" aria-hidden="true" />
              QR code
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href={`/api/admin/documents/${id}/download`}>
              <DownloadIcon className="size-4" aria-hidden="true" />
              Download
            </a>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {archived ? (
            <DropdownMenuItem
              onSelect={() => run(() => restoreDocumentAction(id), "Document restored.")}
              disabled={pending}
            >
              <ArchiveRestoreIcon className="size-4" aria-hidden="true" />
              Restore
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => setConfirmArchive(true)} disabled={pending}>
              <ArchiveIcon className="size-4" aria-hidden="true" />
              Archive
            </DropdownMenuItem>
          )}

          <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)} disabled={pending}>
            <Trash2Icon className="size-4" aria-hidden="true" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

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
        onConfirm={() => run(() => deleteDocumentAction(id), "Document deleted.", onDeleted)}
      />
    </>
  );
}
