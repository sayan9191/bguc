import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

export function moduleName() {
  const p = location.pathname.replace(/\\/g, "/");
  if (p.includes("/admin")) return "admin";
  if (p.includes("/student")) return "student";
  return "voting";
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    detectSessionInUrl: true,
    storageKey: `bguc-auth-${moduleName()}`,
  },
});

export async function mediaUrl(stored) {
  if (!stored) return null;
  if (stored.startsWith("http")) return stored;
  const [bucket, ...rest] = stored.split("/");
  const path = rest.join("/");
  if (!bucket || !path) return stored;
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

export function preview(text, max = 22) {
  const words = (text ?? "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "";
  if (words.length <= max) return words.join(" ");
  return `${words.slice(0, max).join(" ")}…`;
}

export function qs(name) {
  return new URLSearchParams(location.search).get(name);
}
