"use client";

import Link from "next/link";
import type { Project } from "@exhibition/database";
import { useT } from "@exhibition/ui";

export function LeaderboardView({
  group,
  rows,
}: {
  group: string;
  rows: { project_id: string; vote_count: number; project?: Project }[];
}) {
  const t = useT();
  return (
    <div>
      <h1 className="font-display text-3xl text-cream-50 sm:text-4xl">{t("leaderboard")}</h1>
      <div className="-mx-3 my-5 flex gap-2 overflow-x-auto px-3 sm:mx-0 sm:px-0">
        {[
          { id: "All", href: "/leaderboard", label: t("overall") },
          { id: "A", href: "/leaderboard?group=A", label: t("groupA") },
          { id: "B", href: "/leaderboard?group=B", label: t("groupB") },
        ].map((c) => (
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
      <div className="overflow-x-auto rounded-2xl border border-gold-500/15">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-ink-900 text-gold-300">
            <tr>
              <th className="px-3 py-3 sm:px-4">{t("rank")}</th>
              <th className="px-3 py-3 sm:px-4">{t("project")}</th>
              <th className="px-3 py-3 sm:px-4">{t("group")}</th>
              <th className="px-3 py-3 sm:px-4">{t("school")}</th>
              <th className="px-3 py-3 sm:px-4">{t("votesCount")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.project_id} className="border-t border-gold-500/10">
                <td className="px-3 py-3 sm:px-4">{i + 1}</td>
                <td className="px-3 py-3 sm:px-4">{row.project?.model_name}</td>
                <td className="px-3 py-3 sm:px-4">{row.project?.class_group === "A" ? t("groupA") : t("groupB")}</td>
                <td className="px-3 py-3 sm:px-4">{row.project?.school_name}</td>
                <td className="px-3 py-3 sm:px-4">{row.vote_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
