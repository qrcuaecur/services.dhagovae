/**
 * Creates (or promotes) an administrator.
 *
 * There is deliberately no public sign-up route, so this is the only way in.
 * The database trigger gives every new auth user the powerless 'viewer' role;
 * this script performs the explicit promotion to 'admin'.
 *
 *   npm run create-admin -- --email=you@example.com --password='a long passphrase'
 */
import { createClient } from "@supabase/supabase-js";

type Args = { email?: string; password?: string };

function parseArgs(argv: string[]): Args {
  const args: Args = {};

  for (const entry of argv) {
    const match = /^--(email|password)=([\s\S]*)$/.exec(entry);
    if (match) args[match[1] as keyof Args] = match[2];
  }

  return args;
}

function fail(message: string): never {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

async function main() {
  const { email, password } = parseArgs(process.argv.slice(2));

  if (!email || !password) {
    fail("Usage: npm run create-admin -- --email=you@example.com --password='a long passphrase'");
  }

  if (password.length < 12) {
    fail("Choose a password of at least 12 characters for an administrator account.");
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    fail("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local.");
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let userId: string | undefined;

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (created?.user) {
    userId = created.user.id;
    console.log(`\n  Created account ${email}`);
  } else {
    // Already registered is the expected path when promoting an existing user.
    const alreadyExists = /already|registered|exists/i.test(createError?.message ?? "");
    if (!alreadyExists) {
      fail(`Could not create the account: ${createError?.message ?? "unknown error"}`);
    }

    const { data: list, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listError) fail(`Could not look up the existing account: ${listError.message}`);

    const existing = list.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (!existing) fail("That email is registered but could not be found. Check the Supabase dashboard.");

    userId = existing.id;
    console.log(`\n  Found existing account ${email}`);
  }

  // The handle_new_user trigger already inserted the profile row at 'viewer'.
  const { error: promoteError } = await supabase
    .from("profiles")
    .update({ role: "admin", email })
    .eq("id", userId);

  if (promoteError) {
    fail(`Account exists but promoting it to admin failed: ${promoteError.message}`);
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();

  if (profile?.role !== "admin") {
    fail("Promotion did not take effect. Confirm the schema migration has been run.");
  }

  console.log(`  Granted the admin role.`);
  console.log(`\n  Sign in at /admin/login\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
