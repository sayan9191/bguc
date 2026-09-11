import { redirect } from "next/navigation";
import { PageHeader, t } from "@exhibition/ui";
import { supabaseServer } from "@/lib/supabase/server";
import { getLang } from "@/lib/lang";

export default async function RankingPage() {
  const lang = await getLang();
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: student } = await supabase.from("students").select("id").eq("profile_id", user.id).maybeSingle();
  if (!student) redirect("/details");

  const { data: rows, error } = await supabase.rpc("student_live_rankings");
  const list = rows ?? [];
  const mine = list.find((row) => row.is_mine);
  const group = mine?.class_group ?? list[0]?.class_group;
  const groupLabel = group === "A" ? t(lang, "groupA") : t(lang, "groupB");

  return (
    <div>
      <PageHeader title={t(lang, "liveRanking")} subtitle={`${groupLabel} · ${t(lang, "rankingSub")}`} />
      {mine ? (
        <p className="mb-5 text-cream-200/85">
          {t(lang, "yourPosition")}: <span className="text-gold-300">#{mine.rank_in_group}</span> {t(lang, "withVotes")}{" "}
          {mine.vote_count} {t(lang, "votesCount")}.
        </p>
      ) : (
        <p className="mb-5 text-sm text-cream-200/70">{t(lang, "notOnBoard")}</p>
      )}
      {error ? <p className="text-sm text-red-300">{error.message}</p> : null}
      <div className="overflow-x-auto rounded-2xl border border-gold-500/15">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-ink-900 text-gold-300">
            <tr>
              <th className="px-3 py-3 sm:px-4">{t(lang, "rank")}</th>
              <th className="px-3 py-3 sm:px-4">{t(lang, "project")}</th>
              <th className="px-3 py-3 sm:px-4">{t(lang, "school")}</th>
              <th className="px-3 py-3 sm:px-4">{t(lang, "votesCount")}</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-cream-200/60 sm:px-4" colSpan={4}>
                  {t(lang, "noApproved")}
                </td>
              </tr>
            ) : (
              list.map((row) => (
                <tr
                  key={row.project_id}
                  className={`border-t border-gold-500/10 ${row.is_mine ? "bg-gold-500/10" : ""}`}
                >
                  <td className="px-3 py-3 sm:px-4">#{row.rank_in_group}</td>
                  <td className="px-3 py-3 sm:px-4">
                    {row.model_name}
                    {row.is_mine ? ` ${t(lang, "you")}` : ""}
                  </td>
                  <td className="px-3 py-3 sm:px-4">{row.school_name}</td>
                  <td className="px-3 py-3 sm:px-4">{row.vote_count}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
