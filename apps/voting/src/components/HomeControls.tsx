"use client";

import Link from "next/link";
import { useT } from "@exhibition/ui";

export function HomeHero() {
  const t = useT();
  return (
    <section className="mb-6 overflow-hidden rounded-3xl border border-cream-200/10 bg-ink-900/90 px-4 py-8 text-center sm:mb-10 sm:px-12 sm:py-12">
      <p className="text-[11px] uppercase tracking-[0.22em] text-cream-200/70 sm:text-xs">{t("org")}</p>
      <h1 className="mt-2 font-display text-3xl leading-tight text-cream-50 sm:text-6xl">{t("exhibition")}</h1>
      <p className="mt-3 text-base text-cream-200/80 sm:text-lg">{t("voteFavourite")}</p>
      <p className="mx-auto mt-4 max-w-xl rounded-2xl border border-cream-200/15 bg-ink-950/60 px-4 py-3 text-sm text-cream-100">
        {t("voteRule")}
      </p>
      <p className="mt-4 text-xs text-cream-200/50">{t("groupHint")}</p>
    </section>
  );
}

export function GroupFilters({ group, q }: { group: string; q: string }) {
  const t = useT();
  const items = [
    { id: "All", label: t("allProjects"), href: q ? `/?q=${encodeURIComponent(q)}` : "/" },
    { id: "A", label: t("groupA"), href: q ? `/?group=A&q=${encodeURIComponent(q)}` : "/?group=A" },
    { id: "B", label: t("groupB"), href: q ? `/?group=B&q=${encodeURIComponent(q)}` : "/?group=B" },
  ];
  return (
    <div className="-mx-3 mb-6 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:mb-8 sm:px-0">
      {items.map((c) => (
        <Link
          key={c.id}
          href={c.href}
          className={`inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm ${
            group === c.id ? "bg-ink-700 text-cream-50" : "border border-cream-200/20 text-cream-100"
          }`}
        >
          {c.label}
        </Link>
      ))}
    </div>
  );
}

export function SearchBar({ group, q }: { group: string; q: string }) {
  const t = useT();
  return (
    <form className="mb-5 grid gap-2 sm:mb-8 sm:grid-cols-[1fr_auto]" action="/" method="get">
      {group !== "All" ? <input type="hidden" name="group" value={group} /> : null}
      <input
        name="q"
        defaultValue={q}
        placeholder={t("searchPlaceholder")}
        className="min-h-12 w-full rounded-full border border-cream-200/15 bg-ink-900 px-5 text-base outline-none ring-cream-200/30 focus:ring-2 sm:text-sm"
      />
      <button className="min-h-12 rounded-full bg-ink-700 px-6 font-semibold text-cream-50" type="submit">
        {t("search")}
      </button>
    </form>
  );
}
