import { FileIcon, FileImageIcon, FileSpreadsheetIcon, FileTextIcon, PresentationIcon } from "lucide-react";
import { cn } from "cn";

export function FileTypeIcon({ mime, className }: { mime: string; className?: string }) {
  const iconClass = cn("size-4", className);

  if (mime === "application/pdf") return <FileTextIcon className={iconClass} aria-hidden="true" />;
  if (mime.startsWith("image/")) return <FileImageIcon className={iconClass} aria-hidden="true" />;
  if (mime.includes("spreadsheet") || mime.includes("ms-excel")) {
    return <FileSpreadsheetIcon className={iconClass} aria-hidden="true" />;
  }
  if (mime.includes("presentation") || mime.includes("ms-powerpoint")) {
    return <PresentationIcon className={iconClass} aria-hidden="true" />;
  }
  if (mime.includes("word") || mime === "application/msword") {
    return <FileTextIcon className={iconClass} aria-hidden="true" />;
  }

  return <FileIcon className={iconClass} aria-hidden="true" />;
}
