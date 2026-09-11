import { QrCodeIcon } from "lucide-react";
import { cn } from "cn";
import { APP_NAME } from "@/lib/constants";

/**
 * Placeholder brand mark. Swap the icon and APP_NAME in lib/constants.ts
 * for the real identity - nothing else references a company name.
 */
export function Logo({ className, showName = true }: { className?: string; showName?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <span className="bg-primary text-primary-foreground flex size-7 shrink-0 items-center justify-center rounded-md">
        <QrCodeIcon className="size-4" aria-hidden="true" />
      </span>
      {showName ? <span className="text-sm font-semibold tracking-tight">{APP_NAME}</span> : null}
    </span>
  );
}
