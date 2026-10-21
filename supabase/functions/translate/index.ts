// Supabase Edge Function: translate
// Deploy:  supabase functions deploy translate
// Secrets: supabase secrets set GEMINI_API_KEY=... TRANSLATE_PROVIDER=gemini   (or ANTHROPIC_API_KEY=..., or GOOGLE_TRANSLATE_API_KEY=... with TRANSLATE_PROVIDER=google)
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.
import { handle } from "./core.js";

Deno.serve((req: Request) => handle(req, Deno.env.toObject(), fetch));
