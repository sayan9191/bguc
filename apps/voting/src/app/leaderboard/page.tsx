import type { Project } from "@exhibition/database";
import { supabaseServer } from "@/lib/supabase/server";
import { PUBLIC_PROJECT_COLUMNS } from "@/lib/public";
import { TranslatedEmpty } from "@/components/TranslatedEmpty";
import { LeaderboardView } from "@/components/LeaderboardView";

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string }>;
}) {
  const params = await searchParams;
  const group = params.group === "A" || params.group === "B" ? params.group : "All";
  const supabase = await supabaseServer();
  const { data: settings } = await supabase.from("exhibition_settings").select("*").eq("id", 1).maybeSingle();

  if (!settings?.results_visible) {
    return <TranslatedEmpty kind="results" />;
  }

  const { data: counts } = await supabase.rpc("public_vote_counts");
  let projectQuery = supabase.from("projects").select(PUBLIC_PROJECT_COLUMNS).eq("approval_status", "APPROVED");
  if (group !== "All") projectQuery = projectQuery.eq("class_group", group);
  const { data: projects } = await projectQuery;

  const map = new Map(((projects ?? []) as Project[]).map((p) => [p.id, p]));
  const countRows = (counts ?? []) as { project_id: string; vote_count: number }[];
  const rows = countRows
    .map((c) => ({ ...c, project: map.get(c.project_id) }))
    .filter((r) => r.project)
    .sort((a, b) => b.vote_count - a.vote_count);

  return <LeaderboardView group={group} rows={rows} />;
}
