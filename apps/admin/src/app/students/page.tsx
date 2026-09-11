import Link from "next/link";
import { PageHeader } from "@exhibition/ui";
import { requireAdmin } from "@/lib/supabase/server";
import type { Student } from "@exhibition/database";

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; school?: string; class?: string }>;
}) {
  const params = await searchParams;
  const { supabase } = await requireAdmin();
  let query = supabase.from("students").select("*").order("school_name");
  if (params.school) query = query.ilike("school_name", `%${params.school.replace(/%/g, "")}%`);
  if (params.class) query = query.ilike("class_name", `%${params.class.replace(/%/g, "")}%`);
  if (params.q) {
    const q = params.q.replace(/%/g, "");
    query = query.or(`student_names.ilike.%${q}%,contact_number.ilike.%${q}%`);
  }
  const { data } = await query;
  const students = (data ?? []) as Student[];

  return (
    <div>
      <PageHeader title="Students" subtitle="Contact information is private to administrators." />
      <form className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <input name="q" defaultValue={params.q} placeholder="Search name/phone" className="min-h-11 w-full rounded-xl border border-cream-200/15 bg-ink-900 px-3 py-2" />
        <input name="school" defaultValue={params.school} placeholder="School" className="min-h-11 w-full rounded-xl border border-cream-200/15 bg-ink-900 px-3 py-2" />
        <input name="class" defaultValue={params.class} placeholder="Class" className="min-h-11 w-full rounded-xl border border-cream-200/15 bg-ink-900 px-3 py-2" />
        <button className="min-h-11 w-full rounded-xl bg-ink-700 font-semibold text-cream-50">Filter</button>
      </form>

      <div className="grid gap-3 md:hidden">
        {students.map((s) => (
          <article key={s.id} className="surface-card space-y-2 p-4">
            <h2 className="font-display text-lg text-cream-50">{s.student_names}</h2>
            <p className="text-sm text-cream-200/80">{s.school_name}</p>
            <p className="text-sm text-cream-200/60">Class {s.class_name}</p>
            <p className="text-sm text-cream-100">{s.contact_number}</p>
            <Link
              className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-cream-200/20 text-sm text-cream-50"
              href={`/students/${s.id}`}
            >
              Details
            </Link>
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-2xl border border-cream-200/10 md:block">
        <table className="min-w-full text-sm">
          <thead className="bg-ink-900 text-cream-100">
            <tr>
              <th className="px-3 py-2 text-left">Names</th>
              <th className="px-3 py-2 text-left">Class</th>
              <th className="px-3 py-2 text-left">School</th>
              <th className="px-3 py-2 text-left">Contact</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id} className="border-t border-cream-200/10">
                <td className="px-3 py-2">{s.student_names}</td>
                <td className="px-3 py-2">{s.class_name}</td>
                <td className="px-3 py-2">{s.school_name}</td>
                <td className="px-3 py-2">{s.contact_number}</td>
                <td className="px-3 py-2">
                  <Link className="text-cream-50 underline" href={`/students/${s.id}`}>
                    Details
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
