/**
 * Concatenate and optionally apply SQL migrations to the existing Supabase project.
 *
 * Preferred: open supabase/bootstrap.sql in the Supabase SQL Editor and Run.
 *
 * Optional CLI (needs the database password from Project Settings → Database):
 *   DATABASE_URL=postgresql://postgres.[ref]:[PASSWORD]@aws-0-...pooler.supabase.com:6543/postgres
 *   npm run db:apply
 */
import { Client } from "pg";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    const p = resolve(process.cwd(), file);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (!m) continue;
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[m[1]]) process.env[m[1]] = val;
    }
  }
}

function buildBootstrap(): string {
  const dir = resolve(process.cwd(), "supabase/migrations");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const sql = files
    .map((f) => `-- ========== ${f} ==========\n${readFileSync(resolve(dir, f), "utf8")}`)
    .join("\n\n");
  writeFileSync(resolve(process.cwd(), "supabase/bootstrap.sql"), sql);
  return sql;
}

async function main() {
  loadEnv();
  const sql = buildBootstrap();
  console.log("Wrote supabase/bootstrap.sql");

  const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (!databaseUrl) {
    console.log(`
Tables are empty until this SQL is executed on the Supabase project.

Do this now (no table-by-table clicking):

1. Open Supabase → SQL Editor → New query
2. Paste the contents of supabase/bootstrap.sql
3. Click Run
4. Refresh Table Editor — you should see profiles, students, projects, votes, ...

Optional: set DATABASE_URL in .env.local and re-run npm run db:apply
`);
    return;
  }

  const client = new Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  await client.query(sql);
  await client.end();
  console.log("Migrations applied.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
