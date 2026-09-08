// M2 smoke test: connect to Supabase and count reference rows.
//   node scripts/smoke.mjs
// Reads VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY from .env (or the
// environment). No build step; runs on Node 18+.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// Minimal .env loader so this works without extra deps or Node 20's --env-file.
function loadEnv() {
  try {
    for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in process.env)) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // No .env file; rely on the ambient environment.
  }
}

loadEnv();

const url = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error(
    "Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill it in.",
  );
  process.exit(1);
}

const supabase = createClient(url, anonKey, {
  auth: { persistSession: false },
});

const { data, error, count } = await supabase
  .from("commodities")
  .select("slug, display_name", { count: "exact" });

if (error) {
  console.error("Query failed:", error.message);
  process.exit(1);
}

console.log(`commodities rows: ${count ?? data.length}`);
console.log("sample:", data.slice(0, 5).map((r) => r.slug).join(", "));
