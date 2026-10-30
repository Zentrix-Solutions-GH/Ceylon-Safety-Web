// Browser-safe subset of config — no server-only import.
// Server components and actions import from lib/config.ts instead.

function requiredString(name: string): string {
  const val = process.env[name];
  if (!val || !val.trim()) {
    throw new Error(
      `[config] Missing or empty required environment variable: ${name}`
    );
  }
  return val.trim();
}

function requiredUrl(name: string): string {
  const val = requiredString(name);
  try {
    new URL(val);
  } catch {
    throw new Error(
      `[config] Environment variable ${name} must be a valid URL`
    );
  }
  return val;
}

export const publicConfig = {
  supabaseUrl: requiredUrl("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: requiredString("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
} as const;
