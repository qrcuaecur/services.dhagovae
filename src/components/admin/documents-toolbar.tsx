"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2Icon, SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { DOCUMENT_STATUSES, STATUS_LABELS } from "@/lib/constants";

const ALL = "all";

export function DocumentsToolbar({ categories }: { categories: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentQuery = searchParams.get("q") ?? "";
  const [search, setSearch] = useState(currentQuery);
  const debouncedSearch = useDebouncedValue(search, 350);

  const currentCategory = searchParams.get("category") ?? ALL;
  const currentStatus = searchParams.get("status") ?? ALL;

  // Radix resolves a trigger's label from the matching item, which isn't
  // mounted while the dropdown is closed - so the label is passed explicitly.
  const categoryLabel = currentCategory === ALL ? "All categories" : currentCategory;
  const statusLabel =
    currentStatus === ALL ? "All statuses" : (STATUS_LABELS[currentStatus as (typeof DOCUMENT_STATUSES)[number]] ?? "All statuses");

  function buildUrl(changes: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());

    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "" || value === ALL) params.delete(key);
      else params.set(key, value);
    }

    // Any filter change invalidates the current page number.
    params.delete("page");

    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }

  function apply(changes: Record<string, string | null>) {
    startTransition(() => {
      router.replace(buildUrl(changes), { scroll: false });
    });
  }

  // Only navigates when the debounced text actually differs from the URL,
  // so this can't loop against its own navigation.
  useEffect(() => {
    if (debouncedSearch === currentQuery) return;
    apply({ q: debouncedSearch });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1 space-y-1.5">
        <Label htmlFor="document-search">Search</Label>
        <div className="relative">
          <SearchIcon
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <Input
            id="document-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Title, reference, category or filename"
            className="h-9 pl-8"
          />
          {isPending ? (
            <Loader2Icon className="text-muted-foreground absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin" />
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:flex sm:w-auto">
        <div className="space-y-1.5">
          <Label htmlFor="category-filter">Category</Label>
          <Select value={currentCategory} onValueChange={(value) => apply({ category: value })}>
            <SelectTrigger id="category-filter" className="h-9 w-full sm:w-40">
              <SelectValue>{categoryLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="status-filter">Status</Label>
          <Select value={currentStatus} onValueChange={(value) => apply({ status: value })}>
            <SelectTrigger id="status-filter" className="h-9 w-full sm:w-36">
              <SelectValue>{statusLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              {DOCUMENT_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
