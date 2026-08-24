import { createServerClient as createSSRServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Cookie-based Supabase client for AUTH ONLY — checking who's logged in.
 * Uses the anon key, respects RLS. Do not use this for data fetching;
 * use lib/supabase/server.ts (service role) for that until per-user
 * RLS is fully wired to real pharmacist accounts.
 */
export async function createAuthClient() {
  const cookieStore = await cookies();

  return createSSRServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — middleware handles the actual refresh.
          }
        },
      },
    }
  );
}
