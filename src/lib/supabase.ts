import { createClient } from "@supabase/supabase-js";

// The publishable (anon) key ships in every client bundle by design; the
// schema is protected only by permissive, PIN-scoped RLS. Override via
// VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY to point at your own
// project (see README for the schema).
//
// This app lives entirely in the "scoring" schema of a shared project, so the
// client defaults every PostgREST query to that schema. Realtime subscriptions
// are not covered by this default — each .channel() sets schema: "scoring"
// explicitly at its call site.
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || "https://nbqnxvdumlkiluueveol.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5icW54dmR1bWxraWx1dWV2ZW9sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0NzcxMjEsImV4cCI6MjA5NzA1MzEyMX0.A60Jp3X4xe5ZWBQB3kNYGOjUiwUXi8o47fPeGlBVQeE";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  db: { schema: "scoring" },
});
