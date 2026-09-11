import { PageHeader, StatCard } from "@exhibition/ui";
import { requireAdmin } from "@/lib/supabase/server";
import type { Project } from "@exhibition/database";

export default async function VotesPage() {
  const { supabase } = await requireAdmin();
  const { count } = await supabase.from("votes").select("*", { count: "exact", head: true });
  const { data: votes } = await supabase.from("votes").select("id, project_id, created_at").order("created_at", { ascending: false }).limit(200);
  const { data: projects } = await supabase.from("projects").select("id, model_name, category, school_name");
  const { data: attempts } = await supabase
    .from("vote_attempts")
    .select("id, outcome, created_at, project_id")
    .order("created_at", { ascending: false })
    .limit(100);
  const voteRows = (votes ?? []) as { id: string; project_id: string; created_at: string }[];
  const map = new Map(((projects ?? []) as Project[]).map((p) => [p.id, p]));

  const byProject = new Map<string, number>();
  for (const v of voteRows) byProject.set(v.project_id, (byProject.get(v.project_id) ?? 0) + 1);
  const ranked = [...byProject.entries()].sort((a, b) => b[1] - a[1]);

  const suspicious = ((attempts ?? []) as { id: string; outcome: string; created_at: string }[]).filter((a) =>
    ["rate_limited", "already_voted", "unavailable"].includes(a.outcome)
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vote records"
        subtitle="Admin only — this is not the public voting website. Votes cannot be edited. One Google account equals one vote."
      />
      <StatCard label="Total votes" value={count ?? 0} />
      <a className="inline-block text-gold-300" href="/api/export">
        Export results CSV
      </a>
      <h2 className="font-display text-xl sm:text-2xl">Votes by project</h2>
      <div className="overflow-x-auto rounded-2xl border border-cream-200/10">
      <table className="min-w-full text-sm">
        <thead className="text-gold-300">
          <tr>
            <th className="px-2 py-2 text-left">Project</th>
            <th className="px-2 py-2 text-left">Category</th>
            <th className="px-2 py-2 text-left">Votes</th>
          </tr>
        </thead>
        <tbody>
          {ranked.map(([id, n]) => (
            <tr key={id} className="border-t border-gold-500/10">
              <td className="px-2 py-2">{map.get(id)?.model_name}</td>
              <td className="px-2 py-2">{map.get(id)?.category}</td>
              <td className="px-2 py-2">{n}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      <h2 className="font-display text-xl sm:text-2xl">Recent vote timestamps</h2>
      <ul className="space-y-2 break-words text-sm text-cream-200/80">
        {(voteRows ?? []).slice(0, 30).map((v) => (
          <li key={v.id}>
            {v.created_at} · {map.get(v.project_id)?.model_name}
          </li>
        ))}
      </ul>
      <h2 className="font-display text-xl sm:text-2xl">Suspicious activity indicators</h2>
      <p className="text-sm text-cream-200/60">
        These are failed or repeated attempts. They are not proof of a unique human. The official rule remains one Google account = one vote.
      </p>
      <ul className="space-y-1 text-sm">
        {suspicious.slice(0, 40).map((a) => (
          <li key={a.id}>
            {a.created_at} · {a.outcome}
          </li>
        ))}
      </ul>
    </div>
  );
}
