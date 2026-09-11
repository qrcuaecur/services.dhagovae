"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Loader2Icon, TriangleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TextField } from "@/components/admin/text-field";
import { updateDocumentAction } from "@/lib/documents/actions";
import { emptyDocumentFormState } from "@/types/document";
import { DOCUMENT_STATUSES, STATUS_LABELS } from "@/lib/constants";
import { toDateInputValue } from "@/lib/format";
import type { AdminDocument } from "@/types/document";

export function DocumentEditForm({ document }: { document: AdminDocument }) {
  const action = updateDocumentAction.bind(null, document.id);
  const [state, formAction, pending] = useActionState(action, emptyDocumentFormState);

  // Only toast on a genuine transition into success, not on every render.
  const lastOk = useRef(false);
  useEffect(() => {
    if (state.ok && !lastOk.current) toast.success("Changes saved.");
    lastOk.current = state.ok;
  }, [state.ok]);

  const firstError = (field: string) => state.fieldErrors[field]?.[0];

  return (
    <form id="edit" action={formAction} className="bg-card space-y-4 rounded-xl border p-4 sm:p-5" noValidate>
      <h2 className="text-sm font-semibold">Document details</h2>

      <TextField
        id="title"
        label="Document title"
        required
        defaultValue={document.title}
        error={firstError("title")}
        disabled={pending}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="document_number"
          label="Document number"
          defaultValue={document.document_number ?? ""}
          error={firstError("document_number")}
          disabled={pending}
        />
        <TextField
          id="version"
          label="Version"
          defaultValue={document.version ?? ""}
          error={firstError("version")}
          disabled={pending}
        />
        <TextField
          id="category"
          label="Category"
          defaultValue={document.category ?? ""}
          error={firstError("category")}
          disabled={pending}
        />
        <TextField
          id="expires_at"
          label="Expiry date"
          type="date"
          defaultValue={toDateInputValue(document.expires_at)}
          error={firstError("expires_at")}
          disabled={pending}
          hint="Leave empty if it never expires."
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={document.description}
          disabled={pending}
          aria-invalid={Boolean(firstError("description"))}
        />
        {firstError("description") ? (
          <p role="alert" className="text-destructive text-sm">
            {firstError("description")}
          </p>
        ) : null}
      </div>

      <TextField
        id="tags"
        label="Tags"
        defaultValue={document.tags.join(", ")}
        error={firstError("tags")}
        disabled={pending}
        hint="Separate tags with commas."
      />

      <div className="space-y-1.5">
        <Label htmlFor="status">Status</Label>
        <Select name="status" defaultValue={document.status} disabled={pending}>
          <SelectTrigger id="status" className="h-9 w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DOCUMENT_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {STATUS_LABELS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-muted-foreground text-xs">
          Archived and expired documents stay reachable by QR, but show a notice instead of the file.
        </p>
      </div>

      {state.error ? (
        <p role="alert" className="text-destructive flex items-start gap-2 text-sm">
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {state.error}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? (
            <>
              <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
              Saving
            </>
          ) : (
            "Save changes"
          )}
        </Button>
      </div>
    </form>
  );
}
