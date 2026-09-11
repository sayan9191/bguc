import { redirect } from "next/navigation";
import { Card, PageHeader } from "@exhibition/ui";
import { supabaseServer } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/ProfileForm";

export default async function ProfilePage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: student } = await supabase.from("students").select("*").eq("profile_id", user.id).maybeSingle();
  if (!student) redirect("/details");
  const { data: project } = await supabase.from("projects").select("approval_status").eq("student_id", student.id).maybeSingle();
  const locked = project?.approval_status === "APPROVED";

  return (
    <div className="mx-auto max-w-md">
      <PageHeader title="My details" />
      <Card className="mt-4">
        <ProfileForm student={student} locked={locked} />
      </Card>
    </div>
  );
}
