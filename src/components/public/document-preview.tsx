import { FileTypeIcon } from "@/components/shared/file-type-icon";
import { fileTypeLabel, previewKindFor } from "@/lib/constants";
import { formatBytes } from "@/lib/format";

/**
 * Office formats deliberately get a file card rather than an inline viewer:
 * rendering them would mean handing a third-party service the signed URL,
 * which it could cache or log - defeating the private bucket entirely.
 */
export function DocumentPreview({
  fileName,
  fileType,
  fileSize,
  previewUrl,
}: {
  fileName: string;
  fileType: string;
  fileSize: number;
  previewUrl: string | null;
}) {
  const kind = previewKindFor(fileType);

  if (kind === "image" && previewUrl) {
    return (
      <div className="overflow-hidden rounded-xl border bg-white">
        {/* Signed URLs are single-use and short-lived, so next/image
            optimisation would never get a cache hit. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={previewUrl} alt={fileName} className="h-auto w-full object-contain" />
      </div>
    );
  }

  if (kind === "pdf" && previewUrl) {
    return (
      <>
        {/* Mobile browsers render PDF iframes inconsistently, so small
            screens get the file card and the download button instead. */}
        <div className="hidden overflow-hidden rounded-xl border bg-white sm:block">
          <iframe src={previewUrl} title={`Preview of ${fileName}`} className="h-[28rem] w-full" />
        </div>
        <div className="sm:hidden">
          <FileCard fileName={fileName} fileType={fileType} fileSize={fileSize} />
        </div>
      </>
    );
  }

  return <FileCard fileName={fileName} fileType={fileType} fileSize={fileSize} />;
}

function FileCard({ fileName, fileType, fileSize }: { fileName: string; fileType: string; fileSize: number }) {
  return (
    <div className="bg-muted/40 flex flex-col items-center rounded-xl border px-6 py-10 text-center">
      <div className="bg-background text-muted-foreground flex size-14 items-center justify-center rounded-xl border">
        <FileTypeIcon mime={fileType} className="size-6" />
      </div>
      <p className="mt-4 max-w-full truncate text-sm font-medium" title={fileName}>
        {fileName}
      </p>
      <p className="text-muted-foreground mt-1 text-xs">
        {fileTypeLabel(fileType)} · {formatBytes(fileSize)}
      </p>
    </div>
  );
}
