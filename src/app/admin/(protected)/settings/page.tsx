import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/auth/session";
import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { logoutAction } from "@/lib/auth/actions";
import { appUrl } from "@/lib/env";
import { ALLOWED_FILE_TYPES, APP_NAME, MAX_FILE_SIZE_BYTES, PUBLIC_PAGES_NOINDEX } from "@/lib/constants";
import { formatBytes } from "@/lib/format";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await requireAdminPage();

  const portalFacts = [
    { label: "Portal name", value: APP_NAME },
    { label: "Public address", value: appUrl() },
    { label: "Maximum file size", value: formatBytes(MAX_FILE_SIZE_BYTES) },
    { label: "Search engine indexing", value: PUBLIC_PAGES_NOINDEX ? "Disabled for document pages" : "Enabled" },
  ];

  const uniqueLabels = Array.from(new Set(ALLOWED_FILE_TYPES.map((type) => type.label)));

  return (
    <PageContainer>
      <PageHeader title="Settings" description="Your account and how this portal is configured." />

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <section className="bg-card rounded-xl border p-4 sm:p-5" aria-labelledby="account-heading">
          <h2 id="account-heading" className="text-sm font-semibold">
            Account
          </h2>

          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-start justify-between gap-3">
              <dt className="text-muted-foreground">Signed in as</dt>
              <dd className="truncate text-right font-medium">{session.email}</dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt className="text-muted-foreground">Role</dt>
              <dd>
                <Badge variant="secondary">{session.role}</Badge>
              </dd>
            </div>
          </dl>

          <form action={logoutAction} className="mt-5">
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </section>

        <section className="bg-card rounded-xl border p-4 sm:p-5" aria-labelledby="portal-heading">
          <h2 id="portal-heading" className="text-sm font-semibold">
            Portal
          </h2>

          <dl className="mt-4 space-y-3 text-sm">
            {portalFacts.map((fact) => (
              <div key={fact.label} className="flex items-start justify-between gap-3">
                <dt className="text-muted-foreground shrink-0">{fact.label}</dt>
                <dd className="truncate text-right font-medium" title={fact.value}>
                  {fact.value}
                </dd>
              </div>
            ))}
          </dl>

          <p className="text-muted-foreground mt-4 text-xs">
            The public address is encoded into every QR code. Changing it invalidates codes that have already been
            printed.
          </p>
        </section>

        <section className="bg-card rounded-xl border p-4 sm:p-5 lg:col-span-2" aria-labelledby="types-heading">
          <h2 id="types-heading" className="text-sm font-semibold">
            Accepted file types
          </h2>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {uniqueLabels.map((label) => (
              <Badge key={label} variant="outline">
                {label}
              </Badge>
            ))}
          </div>
          <p className="text-muted-foreground mt-4 text-xs">
            Uploads are checked against their actual file contents, not just the file extension.
          </p>
        </section>

        <section className="bg-card rounded-xl border p-4 sm:p-5 lg:col-span-2" aria-labelledby="admins-heading">
          <h2 id="admins-heading" className="text-sm font-semibold">
            Adding administrators
          </h2>
          <p className="text-muted-foreground mt-2 text-sm">
            New accounts are created from the server, never through a public sign-up page. Run{" "}
            <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">
              npm run create-admin -- --email=… --password=…
            </code>{" "}
            to create an administrator or promote an existing account.
          </p>
        </section>
      </div>
    </PageContainer>
  );
}
