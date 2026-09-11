import { notFound } from "next/navigation";

/**
 * The site root shows nothing. Visitors only ever arrive on a /document/[id]
 * address from a QR code; the admin portal is reached solely by typing
 * /admin/login. Returning a 404 keeps the root from advertising either.
 */
export default function HomePage() {
  notFound();
}
