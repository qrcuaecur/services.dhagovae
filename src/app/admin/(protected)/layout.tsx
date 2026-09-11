import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdminPage } from "@/lib/auth/session";

/**
 * Renders the admin chrome. This is NOT the security boundary - Next's docs
 * are explicit that layouts don't re-render across navigations and don't stop
 * child segments rendering. Every page below calls requireAdminPage() itself;
 * React cache() keeps that from costing an extra query.
 */
export default async function ProtectedAdminLayout({ children }: { children: ReactNode }) {
  const session = await requireAdminPage();

  return <AdminShell email={session.email}>{children}</AdminShell>;
}
