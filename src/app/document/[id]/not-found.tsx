/**
 * Shown when a scanned QR points at a document that never existed or was
 * deleted. Deliberately generic and minimal - a deleted document is
 * indistinguishable from one that never existed, so probing ids reveals
 * nothing.
 */
export default function DocumentNotFound() {
  return (
    <main className="flex min-h-svh items-center justify-center px-4 py-12">
      <div className="text-center">
        <h1 className="text-base font-medium">Document unavailable</h1>
        <p className="text-muted-foreground mt-2 max-w-xs text-sm text-balance">
          This document may have been removed, or the QR code may be invalid.
        </p>
      </div>
    </main>
  );
}
