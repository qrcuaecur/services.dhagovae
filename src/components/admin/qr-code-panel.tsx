import { DownloadIcon, ExternalLinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyLinkButton, PrintQrButton } from "@/components/admin/qr-actions";
import { generateQrSvg } from "@/lib/qr/generate";
import { publicDocumentUrl } from "@/lib/env";

/**
 * The preview and both downloads come from the same generator, so what an
 * admin sees on screen is exactly what gets printed.
 */
export async function QrCodePanel({ documentId }: { documentId: string }) {
  const [svg, url] = await Promise.all([generateQrSvg(documentId), Promise.resolve(publicDocumentUrl(documentId))]);

  return (
    <section id="qr" className="bg-card rounded-xl border p-4 sm:p-5" aria-labelledby="qr-heading">
      <h2 id="qr-heading" className="text-sm font-semibold">
        QR code
      </h2>
      <p className="text-muted-foreground mt-1 text-sm">
        This code points at the document&rsquo;s permanent address. It keeps working if the file or its details change.
      </p>

      <div data-print-area className="mt-4 flex flex-col items-center">
        <div
          className="w-full max-w-[220px] rounded-lg border bg-white p-3 [&>svg]:h-auto [&>svg]:w-full"
          // Generated server-side by the qrcode library from our own URL.
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>

      <div className="mt-4 space-y-2">
        <p className="text-muted-foreground text-xs font-medium">Public link</p>
        <code className="bg-muted block truncate rounded-md px-2.5 py-2 font-mono text-xs" title={url}>
          {url}
        </code>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <CopyLinkButton url={url} />
        <Button asChild variant="outline">
          <a href={url} target="_blank" rel="noreferrer noopener">
            <ExternalLinkIcon className="size-4" aria-hidden="true" />
            Open page
          </a>
        </Button>
        <Button asChild variant="outline">
          <a href={`/api/admin/documents/${documentId}/qr?format=svg`}>
            <DownloadIcon className="size-4" aria-hidden="true" />
            SVG
          </a>
        </Button>
        <Button asChild variant="outline">
          <a href={`/api/admin/documents/${documentId}/qr?format=png`}>
            <DownloadIcon className="size-4" aria-hidden="true" />
            PNG
          </a>
        </Button>
        <div className="col-span-2">
          <PrintQrButton />
        </div>
      </div>
    </section>
  );
}
