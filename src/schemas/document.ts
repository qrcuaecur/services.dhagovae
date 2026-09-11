import { z } from "zod";
import { ALLOWED_EXTENSIONS, ALLOWED_MIME_TYPES, DOCUMENT_STATUSES, MAX_FILE_SIZE_BYTES } from "@/lib/constants";

/** Form fields arrive from FormData, so every value is a string here. */
const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, { error: `${label} must be ${max} characters or fewer.` })
    .transform((value) => (value.length > 0 ? value : null));

const tagsField = z
  .string()
  .trim()
  .max(500, { error: "Tags must be 500 characters or fewer." })
  .transform((value) =>
    Array.from(
      new Set(
        value
          .split(",")
          .map((tag) => tag.trim())
          .filter((tag) => tag.length > 0)
      )
    ).slice(0, 20)
  );

const expiryField = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : null))
  .refine((value) => value === null || !Number.isNaN(Date.parse(value)), {
    error: "Enter a valid expiry date.",
  });

const baseFields = {
  title: z
    .string()
    .trim()
    .min(1, { error: "Title is required." })
    .max(300, { error: "Title must be 300 characters or fewer." }),
  description: z
    .string()
    .trim()
    .max(2000, { error: "Description must be 2000 characters or fewer." }),
  document_number: optionalText(100, "Document number"),
  category: optionalText(100, "Category"),
  version: optionalText(50, "Version"),
  tags: tagsField,
  expires_at: expiryField,
};

/** Create: status is not user-supplied, the server always inserts 'active'. */
export const documentUploadSchema = z.object(baseFields);

export const documentUpdateSchema = z.object({
  ...baseFields,
  status: z.enum(DOCUMENT_STATUSES, { error: "Select a valid status." }),
});

export type DocumentUploadInput = z.input<typeof documentUploadSchema>;
export type DocumentUploadValues = z.output<typeof documentUploadSchema>;
export type DocumentUpdateInput = z.input<typeof documentUpdateSchema>;
export type DocumentUpdateValues = z.output<typeof documentUpdateSchema>;

export type FileValidationError = { code: "size" | "mime" | "extension" | "missing"; message: string };

export function extensionOf(fileName: string): string {
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot === -1 || lastDot === fileName.length - 1) return "";
  return fileName.slice(lastDot + 1).toLowerCase();
}

/**
 * Shared by the browser and the server so both reject the same things.
 * The server additionally sniffs magic bytes, which this cannot do.
 */
export function validateFileMeta(file: { name: string; size: number; type: string }): FileValidationError | null {
  if (!file.name || file.size === 0) {
    return { code: "missing", message: "Choose a file to upload." };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      code: "size",
      message: `This file is larger than the ${Math.round(MAX_FILE_SIZE_BYTES / 1024 / 1024)}MB limit.`,
    };
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return { code: "mime", message: "That file type isn't supported." };
  }

  if (!ALLOWED_EXTENSIONS.includes(extensionOf(file.name))) {
    return { code: "extension", message: "That file extension isn't supported." };
  }

  return null;
}
