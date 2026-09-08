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

// No auth session persistence: reference data is world-readable via RLS and the
// scanner has no login. The anon key in the bundle is expected.
export const supabase = createClient<Database>(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
