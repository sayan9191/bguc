import { createBrowserClient } from "@supabase/ssr";
import { hasSupabasePublicConfig } from "./env";

export function createBrowserSupabase() {
  if (!hasSupabasePublicConfig()) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
