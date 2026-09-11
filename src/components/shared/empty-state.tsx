import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="bg-muted text-muted-foreground mb-4 flex size-11 items-center justify-center rounded-full">
        {icon}
      </div>
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="text-muted-foreground mt-1 max-w-sm text-sm text-balance">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
