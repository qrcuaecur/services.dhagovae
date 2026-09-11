import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS } from "@/lib/constants";
import type { DocumentStatus } from "@/types/database";

const STATUS_STYLES: Record<DocumentStatus, string> = {
  active: "border-emerald-600/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  archived: "border-border bg-muted text-muted-foreground",
  expired: "border-amber-600/25 bg-amber-500/10 text-amber-700 dark:text-amber-400",
};

export function StatusBadge({ status }: { status: DocumentStatus }) {
  return (
    <Badge variant="outline" className={STATUS_STYLES[status]}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}
