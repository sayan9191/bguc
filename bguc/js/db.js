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

/**
 * Signs many stored paths in one request per bucket, so a list page with a
 * photo slider per card does not fire dozens of round trips.
 * Returns a Map of stored path to signed URL.
 */
export async function mediaUrls(storedList) {
  const out = new Map();
  const byBucket = new Map();
  for (const stored of new Set((storedList ?? []).filter(Boolean))) {
    if (stored.startsWith("http")) {
      out.set(stored, stored);
      continue;
    }
    const [bucket, ...rest] = stored.split("/");
    const path = rest.join("/");
    if (!bucket || !path) continue;
    if (!byBucket.has(bucket)) byBucket.set(bucket, []);
    byBucket.get(bucket).push({ stored, path });
  }
  for (const [bucket, items] of byBucket) {
    const { data } = await supabase.storage.from(bucket).createSignedUrls(
      items.map((i) => i.path),
      60 * 60
    );
    (data ?? []).forEach((entry, i) => {
      if (entry?.signedUrl) out.set(items[i].stored, entry.signedUrl);
    });
  }
  return out;
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

/**
 * organiser_votes() is capped at 1000 rows. Filter by project so each
 * request stays under that cap, then merge. No database change.
 */
export async function organiserVotesComplete(projectIds) {
  const ids = [...new Set((projectIds ?? []).filter(Boolean))];
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    Accept: "application/json",
  };
  const byId = new Map();
  const load = async (query) => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/organiser_votes${query}`, { headers });
    if (!res.ok) return null;
    const json = await res.json();
    return Array.isArray(json) ? json : null;
  };

  if (ids.length) {
    const chunk = 8;
    for (let i = 0; i < ids.length; i += chunk) {
      const pages = await Promise.all(
        ids.slice(i, i + chunk).map((id) => load(`?project_id=eq.${encodeURIComponent(id)}`))
      );
      for (const rows of pages) {
        if (!rows) continue;
        for (const row of rows) byId.set(row.vote_id, row);
      }
    }
  }

  if (!ids.length || byId.size <= 1000) {
    for (const group of ["A", "B"]) {
      const rows = await load(`?class_group=eq.${group}`);
      if (!rows) continue;
      for (const row of rows) byId.set(row.vote_id, row);
    }
  }

  if (!byId.size) {
    const { data } = await supabase.rpc("organiser_votes");
    return data ?? [];
  }
  return [...byId.values()].sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
}
