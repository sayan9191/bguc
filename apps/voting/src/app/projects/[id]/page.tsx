import { notFound } from "next/navigation";
import type { Project, ProjectMedia, ProjectMember } from "@exhibition/database";
import { supabaseServer } from "@/lib/supabase/server";
import { PUBLIC_PROJECT_COLUMNS } from "@/lib/public";
import { resolveMediaUrl } from "@/lib/media";
import { formatClassLabel } from "@exhibition/database";
import { PhotoSlider, t } from "@exhibition/ui";
import { VoteButton } from "@/components/VoteButton";
import { ProjectMeta, SectionTitle } from "@/components/ProjectMeta";
import { getLang } from "@/lib/lang";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const lang = await getLang();
  const supabase = await supabaseServer();
  const { data: project } = await supabase
    .from("projects")
    .select(PUBLIC_PROJECT_COLUMNS)
    .eq("id", id)
    .eq("approval_status", "APPROVED")
    .maybeSingle();

  if (!project) notFound();
  const p = project as Project;

  const [{ data: members }, { data: media }, { data: myVote }] = await Promise.all([
    supabase.from("project_members").select("id, project_id, student_name, class_name, school_name, created_at").eq("project_id", id),
    supabase.from("project_media").select("id, project_id, media_url, media_type, sort_order, created_at").eq("project_id", id).order("sort_order"),
    supabase.rpc("my_vote"),
  ]);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const cover = await resolveMediaUrl(supabase, p.cover_image_url);
  const gallery = await Promise.all(
    ((media ?? []) as ProjectMedia[]).map(async (m) => ({
      ...m,
      url: await resolveMediaUrl(supabase, m.media_url),
    }))
  );

  const photos = [cover, ...gallery.map((m) => m.url)].filter((url): url is string => Boolean(url));
  const uniquePhotos = photos.filter((url, i, arr) => arr.indexOf(url) === i);

  const voted = Boolean(myVote && typeof myVote === "object" && "voted" in myVote && myVote.voted);
  const votedName =
    myVote && typeof myVote === "object" && "project_name" in myVote
      ? String((myVote as { project_name?: string }).project_name ?? "")
      : null;

  return (
    <article className="space-y-6 sm:space-y-8">
      {uniquePhotos.length ? <PhotoSlider photos={uniquePhotos} alt={p.model_name} /> : null}
      <div className="overflow-hidden rounded-3xl border border-gold-500/15 bg-ink-900">
        <div className="space-y-4 p-4 sm:p-8">
          <ProjectMeta group={p.class_group} school={p.school_name} className={p.class_name} team={p.team_display_names} mentor={p.mentor_name} />
          <p className="text-xs uppercase tracking-[0.18em] text-gold-400">{t(lang, "title")}</p>
          <h1 className="font-display text-3xl text-cream-50 sm:text-4xl">{p.model_name}</h1>
          <p className="text-sm text-gold-400">{p.project_code}</p>
          <p className="text-xs uppercase tracking-[0.18em] text-gold-400">{t(lang, "description")}</p>
          <p className="max-w-3xl whitespace-pre-wrap text-cream-200/80">{p.description}</p>
          <div className="sticky bottom-3 z-20 sm:static">
            <VoteButton
              projectId={p.id}
              projectName={p.model_name}
              signedIn={Boolean(user)}
              alreadyVoted={voted}
              votedProjectName={votedName}
            />
          </div>
        </div>
      </div>

      {(members as ProjectMember[] | null)?.length ? (
        <section>
          <SectionTitle k="members" />
          <ul className="grid gap-3 sm:grid-cols-2">
            {(members as ProjectMember[]).map((m) => (
              <li key={m.id} className="surface-card p-4">
                <p className="text-cream-50">{m.student_name}</p>
                <p className="text-sm text-cream-200/70">
                  {formatClassLabel(m.class_name)} · {m.school_name}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
