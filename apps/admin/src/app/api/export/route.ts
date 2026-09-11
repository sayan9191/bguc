import { requireAdmin } from "@/lib/supabase/server";

export async function GET() {
  const { supabase } = await requireAdmin();
  const { data: votes } = await supabase.from("votes").select("project_id, created_at");
  const { data: projects } = await supabase.from("projects").select("id, project_code, model_name, category, school_name");
  const voteRows = (votes ?? []) as { project_id: string; created_at: string }[];
  const projectRows = (projects ?? []) as {
    id: string;
    project_code: string;
    model_name: string;
    category: string;
    school_name: string | null;
  }[];
  const counts = new Map<string, number>();
  for (const v of voteRows) counts.set(v.project_id, (counts.get(v.project_id) ?? 0) + 1);
  const header = "project_code,model_name,category,school_name,votes";
  const lines = projectRows.map((p) =>
    [p.project_code, p.model_name, p.category, p.school_name, counts.get(p.id) ?? 0]
      .map((x) => `"${String(x ?? "").replace(/"/g, '""')}"`)
      .join(",")
  );
  const csv = [header, ...lines].join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=exhibition-results.csv",
    },
  });
}
