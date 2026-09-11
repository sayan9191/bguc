import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert, PageHeader, PhotoSlider, StatusBadge, t } from "@exhibition/ui";
import { supabaseServer } from "@/lib/supabase/server";
import { resolveMediaUrl } from "@/lib/media";
import { votingProjectUrl } from "@/lib/voting-url";
import { ShareVoteLink } from "@/components/ShareVoteLink";
import { getLang } from "@/lib/lang";

export default async function ProjectPage() {
  const lang = await getLang();
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: student } = await supabase.from("students").select("*").eq("profile_id", user.id).maybeSingle();
  if (!student) redirect("/details");
  const { data: project } = await supabase.from("projects").select("*").eq("student_id", student.id).maybeSingle();

  if (!project) {
    return (
      <div>
        <PageHeader title={t(lang, "myProject")} subtitle={t(lang, "addProjectBody")} />
        <Link className="inline-block rounded-full bg-ink-700 px-5 py-2 font-semibold text-cream-50" href="/project/new">
          {t(lang, "addProject")}
        </Link>
      </div>
    );
  }

  const { data: media } = await supabase
    .from("project_media")
    .select("media_url")
    .eq("project_id", project.id)
    .order("sort_order");
  const stored = [
    ...(project.cover_image_url ? [project.cover_image_url] : []),
    ...((media ?? []).map((m) => m.media_url) as string[]),
  ].filter((url, i, arr) => arr.indexOf(url) === i);
  const photos = (await Promise.all(stored.map((url) => resolveMediaUrl(supabase, url)))).filter(
    (url): url is string => Boolean(url)
  );

  const { data: ranks } = await supabase.rpc("student_live_rankings");
  const mine = (ranks ?? []).find((row) => row.is_mine);
  const approved = project.approval_status === "APPROVED";
  const canEdit = !approved;

  return (
    <div className="space-y-6">
      {approved ? <Alert>{t(lang, "approvedLock")}</Alert> : null}
      {project.approval_status === "PENDING" ? <Alert>{t(lang, "pendingNote")}</Alert> : null}
      {project.approval_status === "REJECTED" ? (
        <Alert tone="error">{project.rejection_reason || t(lang, "rejected")}</Alert>
      ) : null}

      {photos.length ? <PhotoSlider photos={photos} alt={project.model_name} /> : (
        <p className="text-sm text-cream-200/60">{t(lang, "noPhotos")}</p>
      )}

      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-gold-400">{t(lang, "title")}</p>
        <h1 className="mt-1 font-display text-3xl text-cream-50 sm:text-4xl">{project.model_name}</h1>
        {project.project_code ? <p className="mt-1 text-sm text-gold-400">{project.project_code}</p> : null}
        <div className="mt-2">
          <StatusBadge status={project.approval_status} />
        </div>
      </div>

      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-gold-400">{t(lang, "description")}</p>
        <p className="mt-2 whitespace-pre-wrap text-cream-200/90">
          {project.description || t(lang, "noDescription")}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-gold-400">{t(lang, "members")}</p>
          <p className="mt-2 text-cream-200/90">{project.team_display_names || student.student_names}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-gold-400">{t(lang, "mentor")}</p>
          <p className="mt-2 text-cream-200/90">{project.mentor_name || student.mentor_name || "—"}</p>
        </div>
      </div>

      <div className="surface-card grid gap-3 p-5 sm:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-gold-400">{t(lang, "votesCount")}</p>
          <p className="mt-1 font-display text-3xl text-cream-50">{approved ? mine?.vote_count ?? 0 : "—"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-gold-400">{t(lang, "liveRank")}</p>
          <p className="mt-1 font-display text-3xl text-cream-50">
            {approved && mine ? `#${mine.rank_in_group}` : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-gold-400">{t(lang, "group")}</p>
          <p className="mt-1 font-display text-3xl text-cream-50">
            {project.class_group === "A" ? "A" : "B"}
          </p>
        </div>
      </div>
      {!approved ? (
        <p className="text-sm text-cream-200/70">{t(lang, "votesAfter")}</p>
      ) : (
        <Link className="inline-flex text-sm text-gold-300" href="/ranking">
          {t(lang, "openRanking")}
        </Link>
      )}

      <ShareVoteLink url={votingProjectUrl(project.id)} projectName={project.model_name} approved={approved} />

      {canEdit ? (
        <Link className="inline-block rounded-full bg-ink-700 px-5 py-2 font-semibold text-cream-50" href="/project/edit">
          {t(lang, "edit")}
        </Link>
      ) : null}
    </div>
  );
}
