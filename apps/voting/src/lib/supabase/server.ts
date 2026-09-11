import { createServerSupabase } from "@exhibition/database";
import { cookies } from "next/headers";

export async function supabaseServer() {
  const cookieStore = await cookies();
  return createServerSupabase(cookieStore);
}
