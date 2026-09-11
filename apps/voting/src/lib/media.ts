import type { SupabaseClient } from "@supabase/supabase-js";
import { parseStoragePath } from "./public";

export async function resolveMediaUrl(
  supabase: SupabaseClient,
  stored: string | null
): Promise<string | null> {
  if (!stored) return null;
  if (stored.startsWith("http")) return stored;
  const parsed = parseStoragePath(stored);
  if (!parsed) return stored;
  const { data } = await supabase.storage.from(parsed.bucket).createSignedUrl(parsed.path, 60 * 60);
  return data?.signedUrl ?? null;
}
