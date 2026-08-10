import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

let browserClient: ReturnType<typeof createClient<Database>> | undefined;

// v1 has no auth, so a single anon-key client (shared browser instance, fresh instance
// per server request) is enough — no cookie/session sync needed like @supabase/ssr provides.
export function getSupabaseBrowserClient() {
  browserClient ??= createClient<Database>(supabaseUrl, supabaseAnonKey);
  return browserClient;
}

export function createSupabaseServerClient() {
  return createClient<Database>(supabaseUrl, supabaseAnonKey);
}
