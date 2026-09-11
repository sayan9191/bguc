import { PageHeader } from "@exhibition/ui";
import { requireAdmin } from "@/lib/supabase/server";
import type { AuditLog } from "@exhibition/database";

export default async function AuditPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(200);
  const logs = (data ?? []) as AuditLog[];
  return (
    <div>
      <PageHeader title="Audit log" />
      <ul className="space-y-2 text-sm">
        {logs.map((l) => (
          <li key={l.id} className="surface-card break-words p-3">
            <span className="text-gold-300">{l.action}</span> · {l.entity_type} · {l.entity_id} · {l.created_at}
          </li>
        ))}
      </ul>
    </div>
  );
}
