import type { Metadata } from "next";
import { QrCodeIcon } from "lucide-react";
import { PublicShell } from "@/components/public/public-shell";
import { APP_NAME } from "@/lib/constants";

export const metadata: Metadata = { title: APP_NAME };

/**
 * Neutral landing page. It deliberately does not link to or redirect into the
 * admin portal - that is reachable only by typing its full address - so a
 * visitor arriving from a QR code never sees that an admin area exists.
 */
export default function HomePage() {
  return (
    <PublicShell>
      <div className="text-center">
        <div className="bg-muted text-muted-foreground mx-auto flex size-12 items-center justify-center rounded-full">
          <QrCodeIcon className="size-5" aria-hidden="true" />
        </div>

        <h1 className="mt-5 text-xl font-semibold tracking-tight text-balance">{APP_NAME}</h1>
        <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm text-balance">
          Scan the QR code on a document to open it here. Each code links to the current published version.
        </p>
      </div>
    </PublicShell>
  );
}
