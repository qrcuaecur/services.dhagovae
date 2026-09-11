"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2Icon, TriangleAlertIcon, UploadIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { FileTypeIcon } from "@/components/shared/file-type-icon";
import { TextField } from "@/components/admin/text-field";
import { documentUploadSchema, validateFileMeta } from "@/schemas/document";
import { FILE_ACCEPT_ATTRIBUTE, MAX_FILE_SIZE_BYTES, fileTypeLabel } from "@/lib/constants";
import { formatBytes } from "@/lib/format";
import { cn } from "cn";

type Field = "title" | "description" | "document_number" | "category" | "version" | "tags" | "expires_at";
type Phase = "idle" | "preparing" | "uploading" | "finishing";

const EMPTY_VALUES: Record<Field, string> = {
  title: "",
  description: "",
  document_number: "",
  category: "",
  version: "",
  tags: "",
  expires_at: "",
};

class UploadAborted extends Error {}

/**
 * The file goes straight from the browser to Supabase Storage using a signed
 * URL the server issues, then a second call creates the document row. Routing
 * 50MB through a serverless function isn't possible - Vercel and friends cap
 * request bodies at a few megabytes - and this also keeps upload progress and
 * cancellation genuinely responsive.
 */
function putWithProgress(
  signedUrl: string,
  file: File,
  onProgress: (percent: number) => void,
  register: (xhr: XMLHttpRequest | null) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    register(xhr);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };

    xhr.onload = () => {
      register(null);
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error("Upload rejected by storage."));
    };

    xhr.onerror = () => {
      register(null);
      reject(new Error("The upload failed. Check your connection and try again."));
    };

    xhr.onabort = () => {
      register(null);
      reject(new UploadAborted("aborted"));
    };

    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.send(file);
  });
}

export function DocumentUploadForm() {
  const router = useRouter();
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [values, setValues] = useState<Record<Field, string>>(EMPTY_VALUES);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const busy = phase !== "idle";

  const setValue = (field: Field, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  };

  function acceptFile(candidate: File | undefined) {
    setFileError(null);

    if (!candidate) return;

    // The same check the server runs, so obvious problems surface instantly.
    const problem = validateFileMeta({ name: candidate.name, size: candidate.size, type: candidate.type });
    if (problem) {
      setFileError(problem.message);
      return;
    }

    setFile(candidate);
    setValues((current) => ({
      ...current,
      // Offer the filename as a starting title rather than making them retype it.
      title: current.title || candidate.name.replace(/\.[^.]+$/, ""),
    }));
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    acceptFile(event.dataTransfer.files[0]);
  }

  function cancelUpload() {
    xhrRef.current?.abort();
    xhrRef.current = null;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setFormError(null);
    setFieldErrors({});

    if (!file) {
      setFileError("Choose a file to upload.");
      return;
    }

    const parsed = documentUploadSchema.safeParse(values);

    if (!parsed.success) {
      const flattened = parsed.error.flatten().fieldErrors;
      const next: Partial<Record<Field, string>> = {};
      for (const [key, messages] of Object.entries(flattened)) {
        if (messages?.[0]) next[key as Field] = messages[0];
      }
      setFieldErrors(next);
      setFormError("Check the highlighted fields and try again.");
      return;
    }

    try {
      setPhase("preparing");
      setProgress(0);

      const ticketResponse = await fetch("/api/admin/documents/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, fileSize: file.size, fileType: file.type }),
      });

      const ticket = (await ticketResponse.json()) as { id?: string; signedUrl?: string; error?: string };

      if (!ticketResponse.ok || !ticket.id || !ticket.signedUrl) {
        setFormError(ticket.error ?? "We couldn't start this upload. Try again.");
        setPhase("idle");
        return;
      }

      setPhase("uploading");
      await putWithProgress(ticket.signedUrl, file, setProgress, (xhr) => {
        xhrRef.current = xhr;
      });

      setPhase("finishing");

      const finaliseResponse = await fetch("/api/admin/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: ticket.id,
          fileName: file.name,
          fileType: file.type,
          ...values,
        }),
      });

      const result = (await finaliseResponse.json()) as {
        id?: string;
        error?: string;
        fieldErrors?: Record<string, string[]>;
      };

      if (!finaliseResponse.ok || !result.id) {
        if (result.fieldErrors) {
          const next: Partial<Record<Field, string>> = {};
          for (const [key, messages] of Object.entries(result.fieldErrors)) {
            if (messages?.[0]) next[key as Field] = messages[0];
          }
          setFieldErrors(next);
        }
        setFormError(result.error ?? "We couldn't save this document. Try again.");
        setPhase("idle");
        return;
      }

      toast.success("Document uploaded.");
      router.push(`/admin/documents/${result.id}`);
    } catch (error) {
      setPhase("idle");
      setProgress(0);

      if (error instanceof UploadAborted) {
        toast.info("Upload cancelled.");
        return;
      }

      setFormError(
        error instanceof Error ? error.message : "We couldn't upload this document. Please try again."
      );
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      <section className="bg-card rounded-xl border p-4 sm:p-5">
        <h2 className="text-sm font-semibold">File</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          PDF, Word, Excel, PowerPoint or image. Up to {formatBytes(MAX_FILE_SIZE_BYTES)}.
        </p>

        {file ? (
          <div className="mt-4 flex items-center gap-3 rounded-lg border p-3">
            <div className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-md">
              <FileTypeIcon mime={file.type} className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="text-muted-foreground text-xs">
                {fileTypeLabel(file.type)} · {formatBytes(file.size)}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setFile(null)}
              disabled={busy}
              aria-label="Remove selected file"
            >
              <XIcon className="size-4" aria-hidden="true" />
            </Button>
          </div>
        ) : (
          <div
            onDragEnter={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            // dragover must be prevented too, or the browser opens the file
            // instead of letting the drop reach us.
            onDragOver={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              setDragActive(false);
            }}
            onDrop={handleDrop}
            className={cn(
              "mt-4 flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-10 text-center transition-colors",
              dragActive ? "border-primary bg-muted/50" : "border-border"
            )}
          >
            <input
              ref={inputRef}
              type="file"
              accept={FILE_ACCEPT_ATTRIBUTE}
              className="sr-only"
              aria-label="Choose a document to upload"
              aria-describedby={fileError ? "file-error" : undefined}
              onChange={(event) => {
                acceptFile(event.target.files?.[0]);
                // Reset so picking the same file twice still fires a change.
                event.target.value = "";
              }}
            />
            <UploadIcon className="text-muted-foreground size-5" aria-hidden="true" />
            <p className="mt-3 text-sm font-medium">Drag and drop a file here</p>
            <p className="text-muted-foreground mt-1 text-sm">or</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => inputRef.current?.click()}
            >
              Choose file
            </Button>
          </div>
        )}

        {fileError ? (
          <p id="file-error" role="alert" className="text-destructive mt-3 flex items-start gap-2 text-sm">
            <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {fileError}
          </p>
        ) : null}

        {busy ? (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {phase === "preparing" ? "Preparing…" : phase === "uploading" ? "Uploading…" : "Finishing up…"}
              </span>
              {phase === "uploading" ? <span className="tabular-nums">{progress}%</span> : null}
            </div>
            <Progress value={phase === "finishing" ? 100 : progress} aria-label="Upload progress" />
          </div>
        ) : null}
      </section>

      <section className="bg-card space-y-4 rounded-xl border p-4 sm:p-5">
        <h2 className="text-sm font-semibold">Details</h2>

        <TextField
          id="title"
          label="Document title"
          required
          value={values.title}
          error={fieldErrors.title}
          disabled={busy}
          placeholder="Annual Safety Report 2026"
          onChange={(value) => setValue("title", value)}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="document_number"
            label="Document number"
            value={values.document_number}
            error={fieldErrors.document_number}
            disabled={busy}
            placeholder="DOC-2026-001"
            onChange={(value) => setValue("document_number", value)}
          />
          <TextField
            id="version"
            label="Version"
            value={values.version}
            error={fieldErrors.version}
            disabled={busy}
            placeholder="1.0"
            onChange={(value) => setValue("version", value)}
          />
          <TextField
            id="category"
            label="Category"
            value={values.category}
            error={fieldErrors.category}
            disabled={busy}
            placeholder="Safety"
            onChange={(value) => setValue("category", value)}
          />
          <TextField
            id="expires_at"
            label="Expiry date"
            type="date"
            value={values.expires_at}
            error={fieldErrors.expires_at}
            disabled={busy}
            hint="After this date the public page shows an expiry notice."
            onChange={(value) => setValue("expires_at", value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={values.description}
            rows={3}
            disabled={busy}
            placeholder="Annual safety and compliance report."
            onChange={(event) => setValue("description", event.target.value)}
            aria-invalid={Boolean(fieldErrors.description)}
            aria-describedby={fieldErrors.description ? "description-error" : undefined}
          />
          {fieldErrors.description ? (
            <p id="description-error" role="alert" className="text-destructive text-sm">
              {fieldErrors.description}
            </p>
          ) : null}
        </div>

        <TextField
          id="tags"
          label="Tags"
          value={values.tags}
          error={fieldErrors.tags}
          disabled={busy}
          placeholder="safety, compliance, annual"
          hint="Separate tags with commas."
          onChange={(value) => setValue("tags", value)}
        />
      </section>

      {formError ? (
        <p role="alert" className="text-destructive flex items-start gap-2 text-sm">
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {formError}
        </p>
      ) : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {phase === "uploading" ? (
          <Button type="button" variant="outline" size="lg" onClick={cancelUpload}>
            Cancel upload
          </Button>
        ) : null}
        <Button type="submit" size="lg" disabled={busy || !file}>
          {busy ? (
            <>
              <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
              Uploading
            </>
          ) : (
            "Upload document"
          )}
        </Button>
      </div>
    </form>
  );
}
