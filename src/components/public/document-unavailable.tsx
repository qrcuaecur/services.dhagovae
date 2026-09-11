import { ArchiveIcon, CalendarIcon, FileTextIcon } from "lucide-react";
import type { UnavailableReason } from "@/types/document";

const COPY: Record<UnavailableReason, { heading: string; body: string }> = {
  archived: {
    heading: "Document unavailable",
    body: "This document has been archived and is no longer published. Please contact the administrator if you need a copy.",
  },
  expired: {
    heading: "Document expired",
    body: "This document is no longer available. Please contact the administrator for an updated version.",
  },
};

/**
 * Shown at HTTP 200 for a real document that isn't currently published.
 * Only the identifying details appear - enough for someone standing at a
 * printed code to know which document is retired, without republishing its
 * contents.
 */
export function DocumentUnavailable({
  reason,
  title,
  documentNumber,
  version,
}: {
  reason: UnavailableReason;
  title: string;
  documentNumber: string | null;
  version: string | null;
}) {
  const copy = COPY[reason];
  const Icon = reason === "expired" ? CalendarIcon : ArchiveIcon;

  return (
    <div className="text-center">
      <div className="bg-muted text-muted-foreground mx-auto flex size-12 items-center justify-center rounded-full">
        <Icon className="size-5" aria-hidden="true" />
      </div>

      <h1 className="mt-5 text-xl font-semibold tracking-tight text-balance">{copy.heading}</h1>
      <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm text-balance">{copy.body}</p>

      <div className="bg-card mt-6 rounded-xl border p-4 text-left">
        <p className="text-muted-foreground text-xs font-medium">Document</p>
        <p className="mt-1 flex items-start gap-2 text-sm font-medium">
          <FileTextIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {title}
        </p>
        {documentNumber || version ? (
          <p className="text-muted-foreground mt-2 flex flex-wrap gap-x-3 text-xs">
            {documentNumber ? <span className="font-mono">{documentNumber}</span> : null}
            {version ? <span>Version {version}</span> : null}
          </p>
        ) : null}
      </div>
    </div>
  );
}
