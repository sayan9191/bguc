import type { SupabaseClient } from "@supabase/supabase-js";

function parseStoragePath(value: string | null): { bucket: string; path: string } | null {
  if (!value) return null;
  if (value.startsWith("http")) return null;
  const [bucket, ...rest] = value.split("/");
  if (!bucket || rest.length === 0) return null;
  return { bucket, path: rest.join("/") };
}

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
