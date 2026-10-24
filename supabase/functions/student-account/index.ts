// Supabase Edge Function: student-account
// Deploy:  npx supabase functions deploy student-account --use-api --project-ref YOUR_REF
// Optional secret: SITE_URL (for example https://www.inayaquran.com) so password links come back to /learn
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.
import { handle } from "./core.js";

Deno.serve((req: Request) => handle(req, Deno.env.toObject(), fetch));
