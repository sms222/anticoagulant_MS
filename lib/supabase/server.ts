import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only client. Uses the service role key, which bypasses RLS.
 *
 * This is intentional and standard for server components: the key never
 * reaches the browser, and until real auth + per-pharmacist RLS is wired
 * up, this is how the app reads/writes data at all.
 *
 * NEVER import this file from a "use client" component or expose
 * SUPABASE_SERVICE_ROLE_KEY as a NEXT_PUBLIC_* variable.
 */
export function createServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. " +
        "Get the service role key from Supabase dashboard > Project Settings > API " +
        "and add it to your environment — it is not something to share in chat or commit to git."
    );
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
}
