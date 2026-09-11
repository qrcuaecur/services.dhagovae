/**
 * NEXT_PUBLIC_* values are inlined at build time by literal match, so they
 * must be referenced statically here - a dynamic process.env[name] lookup
 * would come back undefined in the browser bundle.
 */
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  appUrl: process.env.NEXT_PUBLIC_APP_URL,
};

function requirePublic(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Missing environment variable ${name}. Copy .env.example to .env.local and fill it in.`);
  }
  return value;
}

export function supabaseUrl(): string {
  return requirePublic(publicEnv.supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL");
}

export function supabaseAnonKey(): string {
  return requirePublic(publicEnv.supabaseAnonKey, "NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

/**
 * Base URL encoded into every QR code. A production build without this set
 * would bake localhost into printed codes, so that fails loudly instead.
 */
export function appUrl(): string {
  const raw = publicEnv.appUrl?.trim();

  if (!raw) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("NEXT_PUBLIC_APP_URL must be set in production - QR codes encode it permanently.");
    }
    return "http://localhost:3000";
  }

  return raw.replace(/\/+$/, "");
}

export function publicDocumentUrl(id: string): string {
  return `${appUrl()}/document/${id}`;
}
