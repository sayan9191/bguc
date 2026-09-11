import { cookies } from "next/headers";
import { parseLang, type Lang } from "@exhibition/ui";

export async function getLang(): Promise<Lang> {
  return parseLang((await cookies()).get("lang")?.value);
}
