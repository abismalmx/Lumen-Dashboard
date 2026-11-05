import type { SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** True when the build was given a Supabase project. Without one the app runs in demo mode. */
export const cloudEnabled = Boolean(url && anonKey);

let client: Promise<SupabaseClient> | null = null;

/** Loaded on demand so demo-only visitors never download the Supabase SDK. */
export function getClient(): Promise<SupabaseClient> {
  if (!cloudEnabled) return Promise.reject(new Error("Supabase is not configured"));
  client ??= import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(url!, anonKey!, { auth: { persistSession: true, autoRefreshToken: true } }),
  );
  return client;
}
