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
 * organiser_votes() is capped at 1000 rows per request. Page with offset,
 * then fill any gaps per project. No database change.
 */
export async function organiserVotesComplete(projectIds) {
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    Accept: "application/json",
    "Content-Type": "application/json",
    Prefer: "count=exact",
  };
  const byId = new Map();
  const load = async (query = "") => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/organiser_votes${query}`, {
      method: "POST",
      headers,
      body: "{}",
    });
    if (!res.ok) return null;
    const json = await res.json();
    return Array.isArray(json) ? json : null;
  };
  const add = (rows) => {
    if (!rows) return 0;
    let added = 0;
    for (const row of rows) {
      if (!row?.vote_id || byId.has(row.vote_id)) continue;
      byId.set(row.vote_id, row);
      added += 1;
    }
    return added;
  };

  for (let offset = 0; offset < 200000; offset += 1000) {
    const rows = await load(`?limit=1000&offset=${offset}`);
    if (!rows) break;
    const added = add(rows);
    if (!added && offset > 0) break;
    if (rows.length < 1000) break;
  }

  let oldest = [...byId.values()].sort((a, b) => String(a.created_at || "").localeCompare(String(b.created_at || "")))[0]?.created_at;
  for (let i = 0; i < 50 && oldest; i += 1) {
    const rows = await load(
      `?created_at=lt.${encodeURIComponent(oldest)}&order=created_at.desc&limit=1000`
    );
    if (!rows?.length) break;
    const added = add(rows);
    if (!added) break;
    oldest = rows[rows.length - 1]?.created_at;
    if (rows.length < 1000) break;
  }

  const ids = [...new Set((projectIds ?? []).filter(Boolean))];
  if (ids.length) {
    const chunk = 8;
    for (let i = 0; i < ids.length; i += chunk) {
      const pages = await Promise.all(
        ids.slice(i, i + chunk).map((id) => load(`?project_id=eq.${encodeURIComponent(id)}`))
      );
      for (const rows of pages) add(rows);
    }
  }

  for (const group of ["A", "B"]) {
    add(await load(`?class_group=eq.${group}`));
  }

  if (!byId.size) {
    const { data } = await supabase.rpc("organiser_votes");
    add(data ?? []);
  }

  return [...byId.values()].sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
}

export function uniqueVoterCount(votes) {
  const keys = new Set();
  for (const v of votes ?? []) {
    const email = String(v.voter_email || "").trim().toLowerCase();
    if (email) {
      keys.add(`e:${email}`);
      continue;
    }
    const name = String(v.voter_name || "").trim().toLowerCase();
    keys.add(name ? `n:${name}` : `v:${v.vote_id}`);
  }
  return keys.size;
}
