import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE } from "@/lib/auth";

export async function POST(request: Request) {
  const store = await cookies();
  store.set(ADMIN_COOKIE, "", { path: "/", maxAge: 0 });
  return NextResponse.redirect(new URL("/login", request.url), { status: 302 });
}
