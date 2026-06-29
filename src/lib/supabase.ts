import { createClient } from "@supabase/supabase-js";

// The publishable (anon) key ships in every client bundle by design; the
// schema is protected only by permissive, PIN-scoped RLS. Override via
// VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY to point at your own
// project (see README for the schema).
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || "https://dntmuseyddsvgaopfyfg.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRudG11c2V5ZGRzdmdhb3BmeWZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0NzcwMjUsImV4cCI6MjA5NzA1MzAyNX0.oywpM9_3sICgTEgcyr7t_lPYlB97g0CDxs0LKgW4EBI";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
