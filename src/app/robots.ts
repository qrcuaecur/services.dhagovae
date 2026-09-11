import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/env";

/**
 * The admin path is deliberately not listed. A robots.txt Disallow is public
 * text, so naming it would advertise the portal to anyone who reads this file
 * - the opposite of the intent. Admin pages carry a noindex tag from the root
 * layout instead, and nothing on the public side links to them.
 *
 * /document/* is also intentionally absent: those pages carry their own
 * noindex tag, and a crawler blocked here would never read it, which can leave
 * the bare URL indexed anyway.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api"],
    },
    host: appUrl(),
  };
}
