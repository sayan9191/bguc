import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

function applyEnvFile(file: string) {
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]?.trim()) {
      process.env[key] = value;
    }
  }
}

function ensureAdminEnv() {
  const cwd = process.cwd();
  applyEnvFile(path.join(cwd, ".env.local"));
  applyEnvFile(path.join(cwd, "apps", "admin", ".env.local"));
  applyEnvFile(path.resolve(cwd, "..", "..", ".env.local"));
  applyEnvFile(path.resolve(cwd, "..", "..", "apps", "admin", ".env.local"));
}

export function createAdminClient(): SupabaseClient {
  ensureAdminEnv();
  const env = process.env;
  const url = (env["NEXT_PUBLIC_SUPABASE_URL"] ?? "").trim();
  const key = (env["SUPABASE_SERVICE_ROLE_KEY"] ?? "").trim();
  if (!url || !key) {
    throw new Error("MISSING_SERVICE_ROLE");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
