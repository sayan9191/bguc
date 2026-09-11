"use server";

import { parseSchoolClass } from "@exhibition/database";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/service";

function admin() {
  return createAdminClient();
}

export async function setProjectStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as "APPROVED" | "REJECTED" | "PENDING";
  const reason = String(formData.get("reason") ?? "") || null;
  await admin()
    .from("projects")
    .update({ approval_status: status, rejection_reason: reason })
    .eq("id", id);
  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
}

export async function saveProject(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const klass = parseSchoolClass(String(formData.get("class_name") ?? ""));
  if (!klass) return { error: "Class must be a number from 1 to 12." };
  const extras = formData
    .getAll("member_extra")
    .map((v) => String(v).trim())
    .filter(Boolean);
  const lead = String(formData.get("lead_name") ?? "").trim();
  const team = [lead, ...extras].filter(Boolean).join(", ");
  const supabase = admin();
  const { error } = await supabase
    .from("projects")
    .update({
      model_name: String(formData.get("model_name")),
      description: String(formData.get("description")),
      category: "Science",
      class_group: String(formData.get("class_group")) === "A" ? "A" : "B",
      school_name: String(formData.get("school_name")),
      class_name: String(klass),
      team_display_names: team,
      mentor_name: String(formData.get("mentor_name") ?? "").trim() || null,
      video_url: String(formData.get("video_url") || "") || null,
    })
    .eq("id", id);
  if (error) return { error: error.message };
  await supabase.from("project_members").delete().eq("project_id", id);
  const names = team.split(",").map((n) => n.trim()).filter(Boolean);
  if (names.length) {
    await supabase.from("project_members").insert(
      names.map((student_name) => ({
        project_id: id,
        student_name,
        class_name: String(klass),
        school_name: String(formData.get("school_name")),
      }))
    );
  }
  const cover = formData.get("cover") as File | null;
  if (cover && cover.size) {
    const path = `${id}/${crypto.randomUUID()}-${cover.name}`;
    await supabase.storage.from("project-images").upload(path, cover, { upsert: true });
    await supabase.from("projects").update({ cover_image_url: `project-images/${path}` }).eq("id", id);
  }
  revalidatePath(`/projects/${id}`);
  return { error: null };
}

export async function deleteProject(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  await admin().from("projects").delete().eq("id", id);
  revalidatePath("/projects");
  redirect("/projects");
}

export async function saveSettings(formData: FormData) {
  const voting_enabled = formData.get("voting_enabled") === "on";
  const results_visible = formData.get("results_visible") === "on";
  const { error } = await admin()
    .from("exhibition_settings")
    .update({
      exhibition_name: String(formData.get("exhibition_name")),
      voting_enabled,
      results_visible,
      voting_start: String(formData.get("voting_start") || "") || null,
      voting_end: String(formData.get("voting_end") || "") || null,
    })
    .eq("id", 1);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return { error: null };
}
