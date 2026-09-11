"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

export const ADMIN_LINKS = [
  { href: "/", label: "Overview" },
  { href: "/projects", label: "Projects" },
  { href: "/students", label: "Students" },
  { href: "/votes", label: "Vote records" },
  { href: "/settings", label: "Settings" },
  { href: "/audit", label: "Audit log" },
];

function isActive(path: string, href: string) {
  if (href === "/") return path === "/";
  return path === href || path.startsWith(`${href}/`);
}

function SignOut() {
  return (
    <form action="/logout" method="post">
      <button type="submit" className="flex min-h-11 w-full items-center rounded-xl px-3 text-left text-cream-200/80">
        Sign out
      </button>
    </form>
  );
}

export function AdminChrome({ children }: { children: ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [path]);

  if (path.startsWith("/login")) {
    return <main className="mx-auto w-full max-w-6xl px-3 py-6 sm:px-4">{children}</main>;
  }

  return (
    <div className="flex min-h-[100dvh]">
      <aside className="hidden w-64 shrink-0 border-r border-cream-200/10 bg-ink-900 p-5 md:flex md:flex-col">
        <p className="text-center font-display text-xl text-cream-50">Admin panel</p>
        <p className="mt-1 text-center text-xs text-cream-200/60">Basirhat Ganapati Utsab Committee</p>
        <nav className="mt-8 grid gap-1 text-sm">
          {ADMIN_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-h-11 items-center rounded-xl px-3 ${
                isActive(path, item.href) ? "bg-ink-700 text-cream-50" : "text-cream-200/80"
              }`}
            >
              {item.label}
            </Link>
          ))}
          <SignOut />
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-50 border-b border-cream-200/10 bg-ink-950/95 backdrop-blur md:hidden">
          <div className="flex items-center justify-between gap-3 px-3 py-3">
            <Link href="/" className="flex min-w-0 items-center gap-2">
              <span className="truncate font-display text-lg text-cream-50">Admin</span>
            </Link>
            <button
              type="button"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-cream-200/20 px-3 text-sm text-cream-50"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? "Close" : "Menu"}
            </button>
          </div>
          {open ? (
            <nav className="grid gap-1 border-t border-cream-200/10 px-3 py-3">
              {ADMIN_LINKS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex min-h-12 items-center rounded-xl px-3 text-sm ${
                    isActive(path, item.href) ? "bg-ink-700 text-cream-50" : "text-cream-100"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              <SignOut />
            </nav>
          ) : null}
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-3 py-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-4 sm:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
