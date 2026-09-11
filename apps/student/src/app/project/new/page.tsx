import { redirect } from "next/navigation";
import { PageHeader } from "@exhibition/ui";
import { supabaseServer } from "@/lib/supabase/server";
import { ProjectForm } from "@/components/ProjectForm";

export default async function NewProjectPage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: student } = await supabase.from("students").select("*").eq("profile_id", user.id).maybeSingle();
  if (!student) redirect("/details");
  const { data: existing } = await supabase.from("projects").select("id").eq("student_id", student.id).maybeSingle();
  if (existing) redirect("/project/edit");

  return (
    <div>
      <PageHeader title="Add project" />
      <ProjectForm student={student} />
    </div>
  );
}
