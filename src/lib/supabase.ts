import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Fail loudly at startup rather than letting the app boot into a broken state
// where every query silently returns "invalid API key" in a store.
if (!url || !anonKey) {
  throw new Error(
    "Missing Supabase configuration. Set VITE_SUPABASE_URL and " +
      "VITE_SUPABASE_ANON_KEY (see .env.example). On Netlify these come from " +
      "the site's environment variables.",
  );
}

// Reads are world-readable via RLS. Writes (community submissions) require an
// identity, so we keep the anonymous-sign-in session around across reloads to
// give each device a stable contributor id. The anon key in the bundle is
// expected; RLS is the security boundary.
export const supabase = createClient<Database>(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true },
});
