# QR Document Portal

An admin uploads a document; the system stores it in a private bucket and issues a permanent QR code. Anyone who scans that code lands on a clean, mobile-first public page and can download the file — no account, and without the storage bucket ever being exposed.

## How it fits together

```
QR code  ──►  /document/{id}  ──►  documents row  ──►  short-lived signed URL  ──►  file
```

The QR encodes the document's **permanent id**, never a storage URL. That means the file can be replaced, the metadata edited, or the storage layout changed entirely, and every printed code keeps working.

### Public and admin are separate surfaces

Someone arriving from a QR code sees a document page and nothing else. The site root is a neutral landing page, no public page links to the admin area, and `robots.txt` deliberately does not name it — a `Disallow` line is public text and would advertise the very path it's meant to protect. The portal is reachable only by typing its full address (`/admin/login`) and signing in.

### Uploads go straight to storage

The browser asks the server for a signed upload URL, uploads the file **directly to Supabase Storage**, then calls back to create the document row.

This is not an optimisation. Serverless platforms cap request bodies at a few megabytes — Vercel's limit is 4.5MB — so proxying a 50MB scan through a route handler would simply fail in production. Routing around the server doesn't weaken validation: the server issues the path, and on finalisation re-reads the object's real size from storage and sniffs its leading bytes, so nothing the browser claimed about the file is taken on trust.

## Setup

### 1. Create a Supabase project

At [supabase.com](https://supabase.com), create a project and wait for it to finish provisioning.

### 2. Run the schema migration

Open **SQL Editor** in the Supabase dashboard, paste the entire contents of
`supabase/migrations/20260911000000_init_schema.sql`, and run it. This creates the tables,
indexes, RLS policies, triggers, and the private `documents` storage bucket.

### 3. Turn off public sign-ups

**Authentication → Sign In / Providers → Email**: disable "Allow new users to sign up".
This portal has no registration page by design; accounts are created from the server.

### 4. Fill in the environment

Copy the values from **Project Settings → API** into `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

`SUPABASE_SERVICE_ROLE_KEY` bypasses every RLS policy. It must never gain a
`NEXT_PUBLIC_` prefix and must never be imported from a Client Component — `lib/supabase/admin.ts`
is marked `server-only` so an attempt to do so fails the build rather than leaking the key.

> **`NEXT_PUBLIC_APP_URL` is baked into every QR code.** Set the real production
> domain before printing any codes; changing it later invalidates the ones already out there.

### 5. Create the first administrator

```bash
npm run create-admin -- --email=you@example.com --password='a long passphrase'
```

New auth users get the powerless `viewer` role from a database trigger. This script performs
the explicit promotion to `admin`, so an account can never become an administrator by accident.
Re-running it on an existing email just promotes that account.

### 6. Run it

```bash
npm run dev     # http://localhost:3000
npm run build   # production build
npm run lint    # eslint
npm run typecheck
```

## Running against a local Supabase stack

Instead of pointing at the hosted project, you can run the whole backend locally with Docker:

```bash
npx supabase start      # applies supabase/migrations automatically
npm run create-admin -- --email=admin@example.com --password='local-test-passphrase-2026'
npm run dev -- -p 3002
```

`supabase/config.toml` uses ports in the 553xx range rather than Supabase's 543xx defaults, so this
stack can run alongside another local Supabase project without colliding. `npx supabase status`
prints the local keys; they go in `.env.local`, and `NEXT_PUBLIC_APP_URL` must match the port the
dev server is actually on.

## Testing

```bash
npm test              # all 41 tests
npm run test:flows    # admin + public user journeys
npm run test:security # RLS, storage and authorization probes
```

Playwright starts the dev server itself if one isn't already running. The suite needs a working
Supabase (local or hosted) and an admin account matching `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD`
(defaults are the local ones above).

`e2e/portal.spec.ts` walks one document through its whole life: upload → QR → public page →
signed download → archive → expire → delete, asserting at each step that the QR keeps resolving.
`e2e/security.spec.ts` skips the UI and probes the database and storage directly with the anon key
and with a non-admin account — the checks that would be meaningless through a browser.

## Security model

| Concern | How it's handled |
| --- | --- |
| Admin route access | `proxy.ts` is an optimistic gate only. The real boundary is `requireAdmin()` in `lib/auth/session.ts`, called by every protected page, Server Action and admin route handler — because Next's own docs warn layouts don't re-render on navigation and don't stop child segments rendering. |
| Session validity | `getUser()` everywhere, never `getSession()` — the latter only decodes an attacker-controlled cookie without revalidating it. |
| Role | Read from the `profiles` table, never from a client-supplied claim. |
| Public document reads | A single service-role function with an explicit column allowlist. `anon` has **no** RLS policy on `documents` at all, so the page fails closed if it's ever mistakenly wired to the browser client. |
| File delivery | Private bucket. Every download mints a 60-second signed URL server-side after re-checking the document is still published; previews get 5 minutes. |
| Uploads | Size, extension and MIME are checked in the browser and again server-side before a signed upload URL is issued. After the bytes land, the server re-reads the object's true size from storage and sniffs its first 4KB with `file-type`, so a renamed file can't pose as a PDF. The storage path is re-derived from the document id server-side — a client can't point the finalise call at someone else's object. Anything that fails deletes the uploaded object. |
| Search input | Stripped of PostgREST filter metacharacters before being interpolated into an `or=` filter. |
| Redirects | `?redirectTo=` only accepts same-site `/admin/` paths. |
| Rate limiting | Sign-in 5 per 5 min per IP+email; public downloads 30/min per IP. |
| Error messages | Sign-in failures are deliberately indistinguishable from one another, so the form can't be used to discover which emails have accounts. |

## Document lifecycle

`status` is `active`, `archived` or `expired`, with a separate `deleted_at` for soft deletion.
Expiry is **derived** from `expires_at` at read time rather than stored, so it's always accurate
without a scheduled job; `status='expired'` remains available as a manual override.

Archiving, expiring or deleting never breaks a QR code — the public page returns a controlled
notice instead of a dead link. A deleted document is deliberately indistinguishable from an id
that never existed, so the page can't be used to probe which ids are real.

## Known limitations

- **Rate limiting is in-process.** It only meaningfully throttles a single long-lived Node process; behind multiple instances or serverless functions each one keeps its own counters. `lib/rate-limit/memory.ts` is written behind an interface so swapping in Redis touches nothing else.
- **Soft-deleted files stay in the bucket.** There's no cleanup job yet.
- **`document_access_logs` is schema-only.** The table exists and is RLS-protected, but nothing writes to it, so there are no scan analytics yet.
- **One current file per document.** The architecture doesn't preclude a versions table, but v1 doesn't have one.
- **An abandoned upload leaves an orphaned object.** If the browser uploads the file and then the tab closes before the document row is created, the object stays in the bucket unreferenced. There's no sweeper job yet.
- **Office documents get a file card, not an inline preview.** Rendering them would mean handing a third-party viewer the signed URL, which it could cache or log.

## Deploying to Vercel

1. Push the repository and import it into Vercel.
2. Add the four environment variables under **Settings → Environment Variables**. `SUPABASE_SERVICE_ROLE_KEY` must **not** have a `NEXT_PUBLIC_` prefix — that prefix is what publishes a value to the browser bundle.
3. Set `NEXT_PUBLIC_APP_URL` to the real production URL (`https://your-domain.com`, no trailing slash) **before generating any QR codes**. It's encoded into every code permanently; changing it later invalidates the ones already printed. The app refuses to build in production without it rather than silently baking in `localhost`.
4. In Supabase, add the production domain under **Authentication → URL Configuration**.
5. Redeploy after changing any environment variable — Next.js inlines `NEXT_PUBLIC_*` values at build time, so they don't update until the next build.

Uploads work regardless of Vercel's 4.5MB function body limit, because the file never passes through the function — see *Uploads go straight to storage* above.

## Branding

`src/lib/constants.ts` holds the placeholder name and copy; `src/components/shared/logo.tsx`
holds the mark. Nothing else hardcodes an identity.
