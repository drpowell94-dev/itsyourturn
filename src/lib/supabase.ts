import { createClient } from "@supabase/supabase-js";

// The publishable (anon) key ships in every client bundle by design; the
// schema is protected only by permissive, PIN-scoped RLS. Override via
// VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY to point at your own
// project (see README for the schema).
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || "https://ltjcqjmwasxlnsemgown.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0amNxam13YXN4bG5zZW1nb3duIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4OTAwNjQsImV4cCI6MjA5NDQ2NjA2NH0.kcow_RmHQX4pRW5_Fm99RD-pTEXrjjtOX4MxsmCzijo";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
