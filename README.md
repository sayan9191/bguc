# Ganesh Puja Science & Art Exhibition

Three independently deployable websites share **one** Supabase project:

| Site | App | Local URL | Intended domain |
| --- | --- | --- | --- |
| Public voting | `apps/voting` | http://localhost:3000 | `vote.<domain>` |
| Student portal | `apps/student` | http://localhost:3001 | `student.<domain>` |
| Admin dashboard | `apps/admin` | http://localhost:3002 | `admin.<domain>` |

Shared backend: `https://bizgybbywllbnuyvcaua.supabase.co`

Do not create another Supabase project. Do not merge the three UIs.

## 1. Architecture

```
apps/student   Next.js 15  — registration, profile, project submit/edit
apps/voting    Next.js 15  — public browse + Google vote
apps/admin     Next.js 15  — approvals, private contacts, settings, analytics
packages/database          — typed client helpers + vote eligibility rules
packages/ui                — shared visual components
packages/config            — Tailwind preset
supabase/migrations        — schema, RLS, RPCs, storage
scripts/import-students.ts — CSV inspect + idempotent import
```

**Official vote rule:** one authenticated Google account = one vote in each group, so at most one Group A vote and one Group B vote. PostgreSQL `UNIQUE (voter_id, class_group)` on `votes` is the source of truth. Browser storage, cookies, IP, and fingerprints are not used to enforce uniqueness.

Private fields (`contact_number`, `whatsapp_number`, `guardian_*`) live only on `students`. The voting app never queries that table.

## 2. Install

```bash
npm install
cp .env.example .env.local
```

Copy the same public variables into each app as well:

```bash
cp .env.example apps/voting/.env.local
cp .env.example apps/student/.env.local
cp .env.example apps/admin/.env.local
```

Fill in keys. Never put `SUPABASE_SERVICE_ROLE_KEY` or `TURNSTILE_SECRET_KEY` in client components.

```bash
npm run dev:voting
npm run dev:student
npm run dev:admin
```

Or all three: `npm run dev`

## 3. Supabase configuration

1. Open the existing project (do not create a new one).
2. SQL Editor → run the files in `supabase/migrations/` **in order** (`0001` … `0008`).
   Alternatively: `npx supabase db push` if the CLI is linked to this project.
3. Confirm tables: `profiles`, `students`, `projects`, `project_members`, `project_media`, `voters`, `votes`, `exhibition_settings`, `audit_logs`, `vote_attempts`.
4. Confirm buckets: `project-images`, `project-media`.
5. Confirm RPC: `submit_vote(uuid)`.

## 4. Google OAuth (voting)

1. Supabase → Authentication → Providers → Google → enable.
2. Create OAuth credentials in Google Cloud (Web application).
3. Authorized redirect URI (Supabase callback):
   `https://bizgybbywllbnuyvcaua.supabase.co/auth/v1/callback`
4. In Supabase Auth URL configuration, add:
   - `http://localhost:3000/auth/callback`
   - `https://vote.<your-domain>/auth/callback`
5. Site URL for local voting: `http://localhost:3000`

Student and admin apps use email/password. Public voters use Google only (no SMS OTP).

## 5. Cloudflare Turnstile

1. Create a Turnstile widget (managed challenge).
2. Set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`.
3. The voting API verifies the token server-side before calling `submit_vote`.
4. If the secret is omitted, development allows votes so you can test locally. Production refuses votes without a successful Turnstile response.

## 6. Environment variables

See `.env.example`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (import script only; server-side)
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY` (server-side)

## 7. Database migration

Apply `supabase/migrations/*.sql` in numeric order. Default settings:

- `voting_enabled = false`
- `results_visible = false`

## 8. CSV import

Place the Google Sheet export at:

`data/exhibition_students.csv`

The file was **not** in this repository when the platform was generated. Do not invent student rows.

Inspect first (prints exact columns, missing values, duplicates, invalid phones):

```bash
npm run inspect:csv
```

Import (idempotent via `students.import_fingerprint`):

```bash
npm run import:students
```

The script preserves the original registration timestamp in `original_registration_at` and stores the raw row in `raw_import`. Phone/WhatsApp data is never sent to the voting app.

Imported projects start as `PENDING` and stay off the public site until an admin approves them.

## 9. Creating the first admin

1. Sign up with email/password in Supabase Auth (or the admin login page — you will be rejected until promoted).
2. In the SQL editor, as a project owner:

```sql
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'ADMIN_EMAIL';
```

Role changes from the browser are blocked. Only this database update (or another privileged SQL session) can create admins. Do not hardcode passwords.

## 10. Student website

```bash
npm run dev:student
```

Students register, claim an imported record (`project code` + phone), then create/edit a project while status is `PENDING`. After `APPROVED`, fields lock with “Changes require admin approval.”

## 11. Voting website

```bash
npm run dev:voting
```

Public visitors browse approved projects, sign in with Google, confirm, and submit one vote per group. A second vote in the same group returns: “You have already voted in Group A. Each person can vote once in each group.”

## 12. Admin website

```bash
npm run dev:admin
```

Protected by server middleware + `is_admin()` (reads `profiles.role` in the database, not a client-supplied flag).

## 13. Deploy each website

Deploy **three** projects (Vercel, Netlify, or similar). Root directory:

- Voting → `apps/voting`
- Student → `apps/student`
- Admin → `apps/admin`

Each needs the env vars above. Only the import script / CI should receive the service role key.

Install command from repo root: `npm install`. Build command: `npm run build --workspace=@exhibition/voting` (and likewise for student/admin).

## 14. Custom domains

Point DNS and add redirect URLs:

- `https://vote.example.com/auth/callback`
- student and admin origins as needed

Keep the three hostnames on separate apps.

## 15. Security considerations

- RLS is enabled on all public tables. Anon can read **approved** projects and members/media only.
- `votes` inserts are denied to clients; only `submit_vote` (security definer) inserts. Updates/deletes are denied. `UNIQUE (voter_id)` rejects a second row even under concurrent requests.
- `submit_vote` checks auth, voting window, approval status, then inserts.
- Rate limiting is recorded in `vote_attempts` (8 calls / 60 seconds / user).
- Turnstile is verified on the Next.js server, never only in the browser.
- Storage paths are `{project_id}/filename`. Students upload only their project folder. Public read requires an approved project (or owner/admin).
- Service role key must never appear in browser bundles.
- IP/device fingerprinting is **not** claimed as one-human-one-vote.

## Tests

```bash
npm test
```

Critical voting eligibility and authorization rules live in `packages/database/src/vote-rules.test.ts`. Database uniqueness is the final guard for simultaneous duplicate requests.

## Build

```bash
npm run build
```
