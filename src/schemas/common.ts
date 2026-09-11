import { z } from "zod";
import { DOCUMENT_STATUSES } from "@/lib/constants";

export const uuidSchema = z.uuid();

export function isUuid(value: string): boolean {
  return uuidSchema.safeParse(value).success;
}

/**
 * PostgREST `or=` filters are a string mini-language: a comma ends a
 * condition and parentheses delimit the group. User text is interpolated
 * into that string, so these characters are stripped rather than trusted.
 * `%` goes too, since the wildcards are ours to add.
 */
export function sanitizeSearchTerm(raw: string): string {
  return raw
    .replace(/[,()"'\\%*]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}

export const documentListParamsSchema = z.object({
  q: z.string().default("").transform(sanitizeSearchTerm),
  category: z
    .string()
    .trim()
    .max(100)
    .default("")
    .transform((value) => (value.length > 0 && value !== "all" ? value : null)),
  status: z
    .string()
    .default("")
    .transform((value) => (DOCUMENT_STATUSES.includes(value as never) ? (value as (typeof DOCUMENT_STATUSES)[number]) : null)),
  sort: z
    .string()
    .default("")
    .transform((value) =>
      value === "title" || value === "updated_at" ? (value as "title" | "updated_at") : ("created_at" as const)
    ),
  direction: z
    .string()
    .default("")
    .transform((value) => (value === "asc" ? ("asc" as const) : ("desc" as const))),
  page: z
    .string()
    .default("")
    .transform((value) => {
      const parsed = Number.parseInt(value, 10);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
    }),
});

export type DocumentListParams = z.output<typeof documentListParamsSchema>;

/** Next 16 gives searchParams as string | string[] | undefined. */
export function parseDocumentListParams(
  searchParams: Record<string, string | string[] | undefined>
): DocumentListParams {
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? (value[0] ?? "") : (value ?? ""));

  return documentListParamsSchema.parse({
    q: first(searchParams.q),
    category: first(searchParams.category),
    status: first(searchParams.status),
    sort: first(searchParams.sort),
    direction: first(searchParams.direction),
    page: first(searchParams.page),
  });
}
