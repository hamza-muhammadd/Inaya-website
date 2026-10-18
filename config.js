/* =====================================================================
   Inaya Quran Academy — public configuration
   ---------------------------------------------------------------------
   Fill these TWO values from Supabase → Project Settings → API:
     • Project URL      → SUPABASE_URL
     • anon / public key → SUPABASE_ANON_KEY

   The anon key is MEANT to be public (it is safe in the browser because
   every table is protected by Row-Level Security in sql/schema.sql).

   ⚠ NEVER put the "service_role" key here or anywhere in this project.
   ===================================================================== */
window.INAYA_CONFIG = {
  SUPABASE_URL: "",       // e.g. "https://abcdxyz.supabase.co"
  SUPABASE_ANON_KEY: ""   // e.g. "eyJhbGciOi..."  (the long "anon public" key)
};
