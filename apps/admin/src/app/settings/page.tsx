import { PageHeader } from "@exhibition/ui";
import { requireAdmin } from "@/lib/supabase/server";
import { SettingsForm } from "@/components/SettingsForm";

export default async function SettingsPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("exhibition_settings").select("*").eq("id", 1).single();
  return (
    <div>
      <PageHeader title="Exhibition settings" />
      {data ? <SettingsForm settings={data} /> : <p>Settings row missing. Apply migrations.</p>}
    </div>
  );
}
