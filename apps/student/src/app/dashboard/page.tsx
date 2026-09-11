import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: student } = await supabase.from("students").select("id").eq("profile_id", user.id).maybeSingle();
  redirect(student ? "/project" : "/details");
}
