import Link from "next/link";
import { LanguageSwitcher, t } from "@exhibition/ui";
import { hasSupabasePublicConfig } from "@exhibition/database";
import { supabaseServer } from "@/lib/supabase/server";
import { getLang } from "@/lib/lang";

export async function SiteNav() {
  const lang = await getLang();
  let user: { id: string } | null = null;
  if (hasSupabasePublicConfig()) {
    const supabase = await supabaseServer();
    const { data } = await supabase.auth.getUser();
    user = data.user;
  }

  const signIn = user ? (
    <form action="/logout" method="post">
      <button className="min-h-11 text-sm text-cream-100" type="submit">
        {t(lang, "signOut")}
      </button>
    </form>
  ) : (
    <Link href="/login" className="inline-flex min-h-11 items-center text-sm text-cream-100">
      {t(lang, "signIn")}
    </Link>
  );

  return (
    <header className="sticky top-0 z-30 border-b border-cream-200/10 bg-ink-950/92 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-3 py-3 sm:px-4 sm:py-4">
        <Link href="/" className="min-w-0">
          <span className="block truncate font-display text-base leading-tight text-cream-50 sm:text-xl">
            {t(lang, "org")}
          </span>
          <span className="block text-[11px] text-cream-200/70 sm:text-xs">{t(lang, "exhibition")}</span>
        </Link>
        <div className="hidden shrink-0 items-center gap-3 sm:flex sm:gap-4">
          <Link href="/" className="inline-flex min-h-11 items-center text-sm text-cream-200/80">
            {t(lang, "projects")}
          </Link>
          <Link href="/leaderboard" className="inline-flex min-h-11 items-center text-sm text-cream-200/80">
            {t(lang, "leaderboard")}
          </Link>
          <LanguageSwitcher />
          {signIn}
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:hidden">{signIn}</div>
      </div>
      <div className="flex items-center gap-4 border-t border-cream-200/10 px-3 py-2 text-sm sm:hidden">
        <Link href="/" className="min-h-10 py-2 text-cream-100">
          {t(lang, "projects")}
        </Link>
        <Link href="/leaderboard" className="min-h-10 py-2 text-cream-100">
          {t(lang, "leaderboard")}
        </Link>
        <div className="ml-auto">
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}
