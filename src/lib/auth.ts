import { supabase } from "@/lib/supabase";

/**
 * Ensure there is a session before a write. Uses Supabase Anonymous Sign-in so
 * a contributor gets a stable device identity with no login UI. Requires
 * "Allow anonymous sign-ins" to be enabled in the project's Auth settings.
 */
export async function ensureAnonymousSession(): Promise<void> {
  const { data } = await supabase.auth.getSession();
  if (data.session) return;

  const { error } = await supabase.auth.signInAnonymously();
  if (error) {
    throw new Error(
      error.message.includes("disabled") || error.status === 422
        ? "Anonymous sign-in is turned off. Enable it in Supabase → Authentication → Sign In / Providers → Anonymous."
        : `Could not start a session: ${error.message}`,
    );
  }
}
