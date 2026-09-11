/**
 * Branding placeholders - swap these for the real organisation identity.
 * Nothing else in the codebase hardcodes a company name.
 */
export const APP_NAME = "Document Portal";
export const APP_TAGLINE = "Secure document access";
export const APP_FOOTER_NOTE = `Powered by ${APP_NAME}`;

export const STORAGE_BUCKET = "documents";

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

/** Signed URLs are minted per request; these are their lifetimes in seconds. */
export const SIGNED_URL_TTL = {
  /** One immediate click. A stale link just needs another click. */
  download: 60,
  /** Long enough to actually read or print an inline preview. */
  preview: 300,
} as const;

/**
 * Public document pages are semi-private business records, so they are
 * excluded from search indexes by default. Flip this if the deployment
 * genuinely wants them discoverable.
 */
export const PUBLIC_PAGES_NOINDEX = true;

export const DOCUMENTS_PER_PAGE = 10;

export type PreviewKind = "pdf" | "image" | "generic";

export type AllowedFileType = {
  mime: string;
  extensions: string[];
  label: string;
  preview: PreviewKind;
};

export const ALLOWED_FILE_TYPES: AllowedFileType[] = [
  { mime: "application/pdf", extensions: ["pdf"], label: "PDF", preview: "pdf" },
  { mime: "image/png", extensions: ["png"], label: "PNG image", preview: "image" },
  { mime: "image/jpeg", extensions: ["jpg", "jpeg"], label: "JPEG image", preview: "image" },
  { mime: "image/webp", extensions: ["webp"], label: "WebP image", preview: "image" },
  { mime: "application/msword", extensions: ["doc"], label: "Word document", preview: "generic" },
  {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    extensions: ["docx"],
    label: "Word document",
    preview: "generic",
  },
  { mime: "application/vnd.ms-excel", extensions: ["xls"], label: "Excel spreadsheet", preview: "generic" },
  {
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    extensions: ["xlsx"],
    label: "Excel spreadsheet",
    preview: "generic",
  },
  { mime: "application/vnd.ms-powerpoint", extensions: ["ppt"], label: "PowerPoint", preview: "generic" },
  {
    mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    extensions: ["pptx"],
    label: "PowerPoint",
    preview: "generic",
  },
];

export const ALLOWED_MIME_TYPES = ALLOWED_FILE_TYPES.map((t) => t.mime);

export const ALLOWED_EXTENSIONS = ALLOWED_FILE_TYPES.flatMap((t) => t.extensions);

/** `accept` attribute for the file input. */
export const FILE_ACCEPT_ATTRIBUTE = [
  ...ALLOWED_MIME_TYPES,
  ...ALLOWED_FILE_TYPES.flatMap((type) => type.extensions.map((ext) => `.${ext}`)),
].join(",");

export function findFileType(mime: string): AllowedFileType | undefined {
  return ALLOWED_FILE_TYPES.find((t) => t.mime === mime);
}

export function fileTypeLabel(mime: string): string {
  return findFileType(mime)?.label ?? "Document";
}

export function previewKindFor(mime: string): PreviewKind {
  return findFileType(mime)?.preview ?? "generic";
}

export const DOCUMENT_STATUSES = ["active", "archived", "expired"] as const;

export const STATUS_LABELS: Record<(typeof DOCUMENT_STATUSES)[number], string> = {
  active: "Active",
  archived: "Archived",
  expired: "Expired",
};
