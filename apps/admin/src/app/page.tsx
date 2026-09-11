import { PageHeader, StatCard } from "@exhibition/ui";
import { requireAdmin } from "@/lib/supabase/server";
import { AnalyticsCharts } from "@/components/AnalyticsCharts";

export default async function AdminHome() {
  const { supabase } = await requireAdmin();
  const [{ count: students }, { count: projects }, { data: allProjects }, { count: votes }, { data: voteRows }] =
    await Promise.all([
      supabase.from("students").select("*", { count: "exact", head: true }),
      supabase.from("projects").select("*", { count: "exact", head: true }),
      supabase.from("projects").select("id, approval_status, class_group, school_name"),
      supabase.from("votes").select("*", { count: "exact", head: true }),
      supabase.from("votes").select("project_id, created_at"),
    ]);

  const list = (allProjects ?? []) as {
    id: string;
    approval_status: string;
    class_group: string;
    school_name: string | null;
  }[];
  const approved = list.filter((p) => p.approval_status === "APPROVED").length;
  const pending = list.filter((p) => p.approval_status === "PENDING").length;
  const rejected = list.filter((p) => p.approval_status === "REJECTED").length;
  const groupA = list.filter((p) => p.class_group === "A").length;
  const groupB = list.filter((p) => p.class_group === "B").length;

  const voteCountByProject = new Map<string, number>();
  const votesByDay = new Map<string, number>();
  for (const v of (voteRows ?? []) as { project_id: string; created_at: string }[]) {
    voteCountByProject.set(v.project_id, (voteCountByProject.get(v.project_id) ?? 0) + 1);
    const day = v.created_at.slice(0, 10);
    votesByDay.set(day, (votesByDay.get(day) ?? 0) + 1);
  }

  const schoolVotes = new Map<string, number>();
  for (const p of list) {
    const n = voteCountByProject.get(p.id) ?? 0;
    if (!p.school_name) continue;
    schoolVotes.set(p.school_name, (schoolVotes.get(p.school_name) ?? 0) + n);
  }

  const topProjects = [...voteCountByProject.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([id, count]) => ({
      name: list.find((p) => p.id === id)?.id.slice(0, 8) ?? id.slice(0, 8),
      votes: count,
    }));

  const namedTop = [...voteCountByProject.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const { data: named } = namedTop.length
    ? await supabase.from("projects").select("id, model_name").in("id", namedTop.map(([id]) => id))
    : { data: [] };

  const namedRows = (named ?? []) as { id: string; model_name: string }[];
  const chartProjects = namedTop.map(([id, votesN]) => ({
    name: namedRows.find((p) => p.id === id)?.model_name ?? id.slice(0, 6),
    votes: votesN,
  }));

  return (
    <div className="space-y-8">
      <PageHeader kicker="Control centre" title="Exhibition overview" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Total students" value={students ?? 0} />
        <StatCard label="Total projects" value={projects ?? 0} />
        <StatCard label="Approved" value={approved} />
        <StatCard label="Pending" value={pending} />
        <StatCard label="Rejected" value={rejected} />
        <StatCard label="Total votes" value={votes ?? 0} />
      </div>
      <AnalyticsCharts
        categoryVotes={[
          { name: "Group A", value: groupA },
          { name: "Group B", value: groupB },
        ]}
        topProjects={chartProjects.length ? chartProjects : topProjects}
        votesOverTime={[...votesByDay.entries()].map(([day, value]) => ({ day, value }))}
        topSchools={[...schoolVotes.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([name, votesN]) => ({ name, votes: votesN }))}
      />
    </div>
  );
}
