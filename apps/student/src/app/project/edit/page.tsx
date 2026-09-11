import { redirect } from "next/navigation";
import { Alert, PageHeader } from "@exhibition/ui";
import { supabaseServer } from "@/lib/supabase/server";
import { ProjectForm } from "@/components/ProjectForm";
import { resolveMediaUrl } from "@/lib/media";

export default async function EditProjectPage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: student } = await supabase.from("students").select("*").eq("profile_id", user.id).maybeSingle();
  if (!student) redirect("/details");
  const { data: project } = await supabase.from("projects").select("*").eq("student_id", student.id).maybeSingle();
  if (!project) redirect("/project/new");

  const { data: media } = await supabase.from("project_media").select("media_url").eq("project_id", project.id);
  const stored = [
    ...(project.cover_image_url ? [project.cover_image_url] : []),
    ...((media ?? []).map((m) => m.media_url) as string[]),
  ].filter((url, i, arr) => arr.indexOf(url) === i);
  const photoUrls = (await Promise.all(stored.map((url) => resolveMediaUrl(supabase, url)))).filter(
    (url): url is string => Boolean(url)
  );
  const existingPhotoCount = stored.length;

  const locked = project.approval_status === "APPROVED";

  return (
    <div>
      <PageHeader title="Edit project" />
      {locked ? (
        <Alert>
          Note: An organiser has approved this project. You cannot change the project details or photos now.
        </Alert>
      ) : null}
      <ProjectForm
        student={student}
        project={project}
        existingPhotoCount={existingPhotoCount}
        photoUrls={photoUrls}
        locked={locked}
      />
    </div>
  );
}
