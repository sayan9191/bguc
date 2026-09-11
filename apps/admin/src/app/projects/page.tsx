import { PageHeader, StatusBadge } from "@exhibition/ui";
import { requireAdmin } from "@/lib/supabase/server";
import { ApproveButtons } from "@/components/ApproveButtons";
import type { Project } from "@exhibition/database";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; group?: string; status?: string }>;
}) {
  const params = await searchParams;
  const { supabase } = await requireAdmin();
  let query = supabase.from("projects").select("*").order("created_at", { ascending: false });
  if (params.group === "A" || params.group === "B") query = query.eq("class_group", params.group);
  if (params.status === "PENDING" || params.status === "APPROVED" || params.status === "REJECTED") {
    query = query.eq("approval_status", params.status);
  }
  if (params.q) query = query.ilike("model_name", `%${params.q.replace(/[%]/g, "")}%`);
  const { data } = await query;
  const projects = (data ?? []) as Project[];

  return (
    <div>
      <PageHeader title="Projects" subtitle="Approve or reject from this list. This is the admin panel, not the public voting site." />
      <form className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" action="/projects">
        <input name="q" defaultValue={params.q} placeholder="Search" className="min-h-11 w-full rounded-xl border border-cream-200/15 bg-ink-900 px-3 py-2" />
        <select name="group" defaultValue={params.group ?? ""} className="min-h-11 w-full rounded-xl border border-cream-200/15 bg-ink-900 px-3 py-2">
          <option value="">All groups</option>
          <option value="A">Group A</option>
          <option value="B">Group B</option>
        </select>
        <select name="status" defaultValue={params.status ?? ""} className="min-h-11 w-full rounded-xl border border-cream-200/15 bg-ink-900 px-3 py-2">
          <option value="">All statuses</option>
          <option>PENDING</option>
          <option>APPROVED</option>
          <option>REJECTED</option>
        </select>
        <button className="min-h-11 w-full rounded-xl bg-ink-700 font-semibold text-cream-50">Filter</button>
      </form>

      {projects.length === 0 ? (
        <p className="surface-card p-4 text-sm text-cream-200/70">
          No projects yet. Students must submit from the student portal (port 3001) before you can approve.
        </p>
      ) : null}

      <div className="grid gap-3 md:hidden">
        {projects.map((p) => (
          <article key={p.id} className="surface-card space-y-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-display text-lg leading-snug text-cream-50">{p.model_name}</h2>
                <p className="mt-1 text-xs text-cream-200/60">
                  {p.project_code} · {p.class_group === "A" ? "Group A" : "Group B"}
                </p>
              </div>
              <StatusBadge status={p.approval_status} />
            </div>
            <ApproveButtons id={p.id} />
            <a
              className="relative z-10 inline-flex min-h-11 w-full items-center justify-center rounded-full border border-cream-200/20 text-sm font-semibold text-cream-50"
              href={`/projects/${p.id}`}
            >
              View
            </a>
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-2xl border border-cream-200/10 md:block">
        <table className="min-w-full text-sm">
          <thead className="bg-ink-900 text-cream-100">
            <tr>
              <th className="px-3 py-2 text-left">Code</th>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Group</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.id} className="border-t border-cream-200/10">
                <td className="px-3 py-2">{p.project_code}</td>
                <td className="px-3 py-2">{p.model_name}</td>
                <td className="px-3 py-2">{p.class_group === "A" ? "Group A" : "Group B"}</td>
                <td className="px-3 py-2">
                  <StatusBadge status={p.approval_status} />
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <ApproveButtons id={p.id} />
                    <a
                      className="relative z-10 inline-flex min-h-11 items-center rounded-full border border-cream-200/20 px-4 text-sm font-semibold text-cream-50"
                      href={`/projects/${p.id}`}
                    >
                      View
                    </a>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
