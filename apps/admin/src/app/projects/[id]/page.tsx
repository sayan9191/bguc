import { notFound } from "next/navigation";
import { PageHeader, PhotoSlider, StatusBadge } from "@exhibition/ui";
import { requireAdmin } from "@/lib/supabase/server";
import { resolveMediaUrl } from "@/lib/media";
import { ProjectAdminActions } from "@/components/ProjectAdminActions";
import type { Project, ProjectMedia, ProjectMember, Student } from "@exhibition/database";

export default async function ProjectDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireAdmin();

  const [{ data: project, error }, { data: members }, { data: media }] = await Promise.all([
    supabase.from("projects").select("*").eq("id", id).maybeSingle(),
    supabase.from("project_members").select("*").eq("project_id", id),
    supabase.from("project_media").select("*").eq("project_id", id).order("sort_order"),
  ]);

  if (error) {
    return <p className="text-red-200">Could not load this project: {error.message}</p>;
  }
  if (!project) notFound();
  const p = project as Project;

  const { data: student } = p.student_id
    ? await supabase.from("students").select("*").eq("id", p.student_id).maybeSingle()
    : { data: null };

  const cover = await resolveMediaUrl(supabase, p.cover_image_url);
  const gallery = await Promise.all(
    ((media ?? []) as ProjectMedia[]).map(async (m) => resolveMediaUrl(supabase, m.media_url))
  );
  const photos = [cover, ...gallery].filter((url): url is string => Boolean(url));
  const uniquePhotos = photos.filter((url, i, arr) => arr.indexOf(url) === i);

  return (
    <div className="space-y-6">
      <a href="/projects" className="inline-flex min-h-11 items-center text-sm text-cream-200/80">
        ← Back to projects
      </a>
      <PageHeader title={p.model_name} subtitle={p.project_code} />
      <StatusBadge status={p.approval_status} />
      {uniquePhotos.length ? <PhotoSlider photos={uniquePhotos} alt={p.model_name} /> : null}
      <p className="whitespace-pre-wrap text-cream-200/80">{p.description}</p>
      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-[0.18em] text-cream-200/60">School</dt>
          <dd>{p.school_name}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[0.18em] text-cream-200/60">Class</dt>
          <dd>{p.class_name}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[0.18em] text-cream-200/60">Group</dt>
          <dd>{p.class_group === "A" ? "Group A" : "Group B"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[0.18em] text-cream-200/60">Team</dt>
          <dd>{p.team_display_names}</dd>
        </div>
      </dl>
      {student ? (
        <section className="surface-card p-5">
          <h2 className="font-display text-2xl">Private student contact</h2>
          <p>{(student as Student).student_names}</p>
          <p>Mentor: {(student as Student).mentor_name || "—"}</p>
          <p>Contact: {(student as Student).contact_number}</p>
        </section>
      ) : null}
      <ul className="space-y-2">
        {(members as ProjectMember[] | null)?.map((m) => (
          <li key={m.id}>
            {m.student_name} · {m.class_name}
          </li>
        ))}
      </ul>
      <ProjectAdminActions project={p} members={(members as ProjectMember[]) ?? []} />
    </div>
  );
}
