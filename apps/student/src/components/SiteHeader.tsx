import Link from "next/link";
import { LanguageSwitcher, t } from "@exhibition/ui";
import { hasSupabasePublicConfig } from "@exhibition/database";
import { supabaseServer } from "@/lib/supabase/server";
import { HeaderNav } from "./HeaderNav";
import { getLang } from "@/lib/lang";

export async function SiteHeader() {
  const lang = await getLang();
  let signedIn = false;
  let portalReady = false;
  if (hasSupabasePublicConfig()) {
    const supabase = await supabaseServer();
    const { data } = await supabase.auth.getUser();
    signedIn = Boolean(data.user);
    if (data.user) {
      const { data: student } = await supabase.from("students").select("id").eq("profile_id", data.user.id).maybeSingle();
      portalReady = Boolean(student);
    }
  }

  return (
    <header className="border-b border-cream-200/10 bg-ink-950/85 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-3 py-3 sm:px-4 sm:py-4">
        <Link href={signedIn && portalReady ? "/project" : signedIn ? "/details" : "/login"} className="flex min-w-0 items-center gap-3">
          <span className="min-w-0">
            <span className="block truncate font-display text-base leading-tight text-cream-50 sm:text-xl">
              {t(lang, "org")}
            </span>
            <span className="block text-[11px] text-cream-200/70 sm:text-xs">{t(lang, "studentPortal")}</span>
          </span>
        </Link>
        <div className="flex min-w-0 items-center gap-3">
          <HeaderNav portalReady={portalReady} className="hidden gap-4 text-sm text-cream-200/80 sm:flex" />
          <span className={portalReady ? "hidden sm:inline-flex" : "inline-flex"}>
            <LanguageSwitcher />
          </span>
        </div>
      </div>
      {portalReady ? (
        <div className="flex items-center gap-4 border-t border-cream-200/10 px-3 py-2 text-sm text-cream-200/80 sm:hidden">
          <HeaderNav portalReady={portalReady} className="flex min-w-0 flex-1 gap-4" />
          <LanguageSwitcher />
        </div>
      ) : null}
    </header>
  );
}
