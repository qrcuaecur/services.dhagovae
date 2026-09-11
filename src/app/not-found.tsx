/**
 * Deliberately bare. The site has no public pages other than /document/[id],
 * so a 404 shows nothing that hints at what else exists.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-svh items-center justify-center px-4">
      <p className="text-muted-foreground text-sm">Not found.</p>
    </main>
  );
}
