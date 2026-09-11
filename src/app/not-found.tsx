import Link from "next/link";
import { PublicShell } from "@/components/public/public-shell";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <PublicShell>
      <div className="text-center">
        <h1 className="text-xl font-semibold tracking-tight">Page not found</h1>
        <p className="text-muted-foreground mt-2 text-sm">We couldn&rsquo;t find the page you were looking for.</p>
        <Button asChild variant="outline" className="mt-6">
          <Link href="/">Go back</Link>
        </Button>
      </div>
    </PublicShell>
  );
}
