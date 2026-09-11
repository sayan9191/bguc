import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@exhibition/ui";
import { requireAdmin } from "@/lib/supabase/server";
import type { Project, Student } from "@exhibition/database";

export default async function StudentDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireAdmin();
  const { data: student } = await supabase.from("students").select("*").eq("id", id).maybeSingle();
  if (!student) notFound();
  const s = student as Student;
  const { data: project } = await supabase.from("projects").select("*").eq("student_id", s.id).maybeSingle();

  return (
    <div className="space-y-4">
      <PageHeader title={s.student_names} />
      <div className="surface-card space-y-2 p-5">
        <p>Class: {s.class_name}</p>
        <p>School: {s.school_name}</p>
        <p>Contact: {s.contact_number}</p>
        <p>WhatsApp: {s.whatsapp_number}</p>
        <p>
          Guardian: {s.guardian_name} {s.guardian_contact}
        </p>
        <p>Original registration: {s.original_registration_at ?? "n/a"}</p>
      </div>
      {project ? (
        <Link className="text-gold-300" href={`/projects/${(project as Project).id}`}>
          Open project {(project as Project).project_code}
        </Link>
      ) : (
        <p>No project linked.</p>
      )}
    </div>
  );
}
