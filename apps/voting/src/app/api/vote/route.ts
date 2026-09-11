import { NextResponse } from "next/server";
import { evaluateVoteAttempt, mapVoteCode, VOTE_MESSAGES } from "@exhibition/database";
import { verifyTurnstile } from "@/lib/public";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await supabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, code: "unauthenticated", message: VOTE_MESSAGES.unauthenticated },
      { status: 401 }
    );
  }

  const payload = (await request.json().catch(() => null)) as {
    project_id?: string;
    turnstile_token?: string;
  } | null;

  const projectId = payload?.project_id;
  if (!projectId || typeof projectId !== "string") {
    return NextResponse.json(
      { ok: false, code: "unavailable", message: VOTE_MESSAGES.unavailable },
      { status: 400 }
    );
  }

  const turnstileOk = await verifyTurnstile(payload?.turnstile_token);
  if (!turnstileOk) {
    return NextResponse.json({ ok: false, code: "turnstile", message: VOTE_MESSAGES.turnstile }, { status: 400 });
  }

  const [{ data: settings }, { data: project }, { data: myVote }] = await Promise.all([
    supabase.from("exhibition_settings").select("*").eq("id", 1).maybeSingle(),
    supabase
      .from("projects")
      .select("id, approval_status")
      .eq("id", projectId)
      .maybeSingle(),
    supabase.rpc("my_vote"),
  ]);

  const precheck = evaluateVoteAttempt({
    authenticatedUserId: user.id,
    existingVoteProjectId:
      myVote && typeof myVote === "object" && "voted" in myVote && myVote.voted
        ? String((myVote as { project_id?: string }).project_id ?? "voted")
        : null,
    project: project as { id: string; approval_status: "PENDING" | "APPROVED" | "REJECTED" } | null,
    settings: settings as {
      voting_enabled: boolean;
      voting_start: string | null;
      voting_end: string | null;
    } | null,
  });

  if (!precheck.ok) {
    return NextResponse.json(precheck, { status: 409 });
  }

  const { data, error } = await supabase.rpc("submit_vote", { p_project_id: projectId });
  if (error) {
    const duplicate = /unique|duplicate|votes_one_per_voter/i.test(error.message);
    return NextResponse.json(
      {
        ok: false,
        code: duplicate ? "already_voted" : "unauthorized",
        message: duplicate ? VOTE_MESSAGES.already_voted : error.message,
      },
      { status: duplicate ? 409 : 400 }
    );
  }

  const result = data as { ok?: boolean; code?: string; message?: string };
  const code = mapVoteCode(result?.code);
  return NextResponse.json(
    {
      ok: Boolean(result?.ok),
      code,
      message: result?.message || VOTE_MESSAGES[code],
    },
    { status: result?.ok ? 200 : 409 }
  );
}
