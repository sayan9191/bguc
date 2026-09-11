"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@exhibition/ui";

export function HeaderNav({
  portalReady,
  className,
}: {
  portalReady: boolean;
  className: string;
}) {
  const path = usePathname();
  const t = useT();
  if (path === "/login" || path === "/register" || !portalReady) return null;

  return (
    <nav className={className}>
      <Link href="/project">{t("myProject")}</Link>
      <Link href="/ranking">{t("ranking")}</Link>
      <Link href="/profile">{t("details")}</Link>
      <form action="/logout" method="post">
        <button type="submit" className="text-cream-100">
          {t("signOut")}
        </button>
      </form>
    </nav>
  );
}
