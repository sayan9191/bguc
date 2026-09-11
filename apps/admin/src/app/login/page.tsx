import { PageHeader } from "@exhibition/ui";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  return (
    <div className="mx-auto max-w-md py-8">
      <PageHeader title="Admin sign in" subtitle="Use the organiser account." />
      {params.error ? (
        <p className="mb-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-100">
          Wrong username or password.
        </p>
      ) : null}
      <form method="post" action="/api/login" className="surface-card space-y-4 p-5">
        <label className="block text-xs uppercase tracking-[0.18em] text-cream-200/70" htmlFor="username">
          Username
        </label>
        <input
          id="username"
          name="username"
          autoComplete="username"
          required
          className="min-h-11 w-full rounded-xl border border-cream-200/15 bg-ink-950 px-3 py-2"
        />
        <label className="block text-xs uppercase tracking-[0.18em] text-cream-200/70" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="min-h-11 w-full rounded-xl border border-cream-200/15 bg-ink-950 px-3 py-2"
        />
        <button type="submit" className="min-h-11 w-full rounded-full bg-ink-700 font-semibold text-cream-50">
          Sign in
        </button>
      </form>
    </div>
  );
}
