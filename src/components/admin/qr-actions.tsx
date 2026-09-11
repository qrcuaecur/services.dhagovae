"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CheckIcon, CopyIcon, PrinterIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access needs a secure context and can be blocked outright.
      toast.error("Couldn't copy automatically. Select the link and copy it manually.");
    }
  }

  return (
    <Button type="button" variant="outline" className="w-full" onClick={copy}>
      {copied ? (
        <CheckIcon className="size-4" aria-hidden="true" />
      ) : (
        <CopyIcon className="size-4" aria-hidden="true" />
      )}
      {copied ? "Copied" : "Copy link"}
    </Button>
  );
}

export function PrintQrButton() {
  return (
    <Button type="button" variant="outline" className="w-full" onClick={() => window.print()}>
      <PrinterIcon className="size-4" aria-hidden="true" />
      Print
    </Button>
  );
}
