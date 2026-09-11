import { redirect } from "next/navigation";
import { createAdminClient } from "./service";

export async function requireAdmin() {
  try {
    return { supabase: createAdminClient() };
  } catch (error) {
    if (error instanceof Error && error.message === "MISSING_SERVICE_ROLE") {
      redirect("/setup");
    }
    throw error;
  }
}
