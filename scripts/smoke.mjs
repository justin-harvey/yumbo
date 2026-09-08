// M2 smoke test: connect to Supabase and count reference rows.
//   node scripts/smoke.mjs
// Reads VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY from .env (or the
// environment). No build step; runs on Node 18+.
//
// This hits PostgREST directly with fetch rather than @supabase/supabase-js:
// the JS client eagerly opens a realtime WebSocket, which Node < 22 lacks. The
// in-browser client (src/lib/supabase.ts) has no such problem.

import { readFileSync } from "node:fs";

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

const res = await fetch(
  `${url}/rest/v1/commodities?select=slug,display_name&order=slug`,
  {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      Prefer: "count=exact",
    },
  },
);

if (!res.ok) {
  console.error(`Query failed: HTTP ${res.status} — ${await res.text()}`);
  process.exit(1);
}

const rows = await res.json();
// PostgREST returns the exact count in Content-Range, e.g. "0-12/13".
const count = res.headers.get("content-range")?.split("/")[1] ?? rows.length;

console.log(`commodities rows: ${count}`);
console.log("sample:", rows.slice(0, 5).map((r) => r.slug).join(", "));
