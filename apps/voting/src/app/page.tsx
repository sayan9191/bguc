import { Alert, Card } from "@exhibition/ui";
import type { Project } from "@exhibition/database";
import { hasSupabasePublicConfig } from "@exhibition/database";
import { supabaseServer } from "@/lib/supabase/server";
import { PUBLIC_PROJECT_COLUMNS } from "@/lib/public";
import { resolveMediaUrl } from "@/lib/media";
import { ProjectCard } from "@/components/ProjectCard";
import { GroupFilters, HomeHero, SearchBar } from "@/components/HomeControls";
import { TranslatedEmpty } from "@/components/TranslatedEmpty";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string; q?: string }>;
}) {
  const params = await searchParams;
  const group = params.group === "A" || params.group === "B" ? params.group : "All";
  const q = (params.q ?? "").trim().replace(/[%_,()]/g, "");

  if (!hasSupabasePublicConfig()) {
    return (
      <div className="space-y-6">
        <Card>
          <h1 className="font-display text-3xl text-cream-50">Connect Supabase</h1>
          <p className="mt-3 text-cream-200/80">
            This website has no API keys yet, and your Supabase project still has an empty public schema.
          </p>
          <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm text-cream-100">
            <li>
              Run <code className="text-gold-300">supabase/migrations/0009_science_groups.sql</code> in SQL Editor
              after the base migrations.
            </li>
          </ol>
        </Card>
        <Alert>Apply SQL migrations so dummy science projects appear.</Alert>
      </div>
    );
  }

  const supabase = await supabaseServer();
  let query = supabase
    .from("projects")
    .select(PUBLIC_PROJECT_COLUMNS)
    .eq("approval_status", "APPROVED")
    .order("model_name");

  if (group !== "All") query = query.eq("class_group", group);
  if (q) query = query.or(`model_name.ilike.%${q}%,school_name.ilike.%${q}%,team_display_names.ilike.%${q}%`);

  const { data: projects } = await query;
  const { data: settings } = await supabase.from("exhibition_settings").select("*").eq("id", 1).maybeSingle();
  const { data: counts } = settings?.results_visible
    ? await supabase.rpc("public_vote_counts")
    : { data: [] as { project_id: string; vote_count: number }[] };

  const countRows = (counts ?? []) as { project_id: string; vote_count: number }[];
  const countMap = new Map(countRows.map((c) => [c.project_id, c.vote_count]));
  const list = (projects ?? []) as Project[];
  const ids = list.map((p) => p.id);
  const { data: mediaRows } =
    ids.length > 0
      ? await supabase.from("project_media").select("project_id, media_url, sort_order").in("project_id", ids)
      : { data: [] as { project_id: string; media_url: string; sort_order: number }[] };
  const firstPhoto = new Map<string, string>();
  for (const row of (mediaRows ?? []) as { project_id: string; media_url: string; sort_order: number }[]) {
    const current = firstPhoto.get(row.project_id);
    if (!current) firstPhoto.set(row.project_id, row.media_url);
  }
  const withImages = await Promise.all(
    list.map(async (p) => ({
      ...p,
      image: await resolveMediaUrl(supabase, p.cover_image_url || firstPhoto.get(p.id) || null),
      vote_count: settings?.results_visible ? countMap.get(p.id) ?? 0 : null,
    }))
  );

  return (
    <div>
      <HomeHero />
      <SearchBar group={group} q={q} />
      <GroupFilters group={group} q={q} />
      {withImages.length === 0 ? (
        <TranslatedEmpty kind="projects" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
          {withImages.map((p) => (
            <ProjectCard
              key={p.id}
              id={p.id}
              name={p.model_name}
              group={p.class_group}
              school={p.school_name}
              className={p.class_name}
              team={p.team_display_names}
              description={p.description}
              image={p.image}
              voteCount={p.vote_count}
            />
          ))}
        </div>
      )}
    </div>
  );
}
