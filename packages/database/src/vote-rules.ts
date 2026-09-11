import type { ApprovalStatus, ExhibitionSettings, VoteResultCode } from "./types";

export type VotingWindowStatus = "open" | "disabled" | "not_started" | "ended" | "closed";

export function evaluateVotingWindow(
  settings: Pick<ExhibitionSettings, "voting_enabled" | "voting_start" | "voting_end"> | null,
  now: Date = new Date()
): VotingWindowStatus {
  if (!settings) return "closed";
  if (!settings.voting_enabled) return "disabled";
  if (settings.voting_start && now < new Date(settings.voting_start)) return "not_started";
  if (settings.voting_end && now > new Date(settings.voting_end)) return "ended";
  return "open";
}

export function votingWindowMessage(status: VotingWindowStatus): string {
  switch (status) {
    case "disabled":
    case "closed":
      return "Voting is currently closed.";
    case "not_started":
      return "Voting has not started yet.";
    case "ended":
      return "Voting has ended.";
    default:
      return "";
  }
}

export type VoteAttemptInput = {
  authenticatedUserId: string | null;
  existingVoteProjectId: string | null;
  project: { id: string; approval_status: ApprovalStatus } | null;
  settings: Pick<ExhibitionSettings, "voting_enabled" | "voting_start" | "voting_end"> | null;
  now?: Date;
  recentAttemptCount?: number;
};

export function evaluateVoteAttempt(input: VoteAttemptInput): {
  ok: boolean;
  code: VoteResultCode;
  message: string;
} {
  if (!input.authenticatedUserId) {
    return {
      ok: false,
      code: "unauthenticated",
      message: "You must sign in with Google to vote.",
    };
  }

  if ((input.recentAttemptCount ?? 0) >= 8) {
    return {
      ok: false,
      code: "rate_limited",
      message: "Too many attempts. Please wait a moment and try again.",
    };
  }

  const windowStatus = evaluateVotingWindow(input.settings, input.now);
  if (windowStatus !== "open") {
    const code: VoteResultCode =
      windowStatus === "not_started" ? "not_started" : windowStatus === "ended" ? "ended" : "disabled";
    return { ok: false, code, message: votingWindowMessage(windowStatus) };
  }

  if (!input.project || input.project.approval_status !== "APPROVED") {
    return {
      ok: false,
      code: "unavailable",
      message: "This project is not currently available for voting.",
    };
  }

  if (input.existingVoteProjectId) {
    return {
      ok: false,
      code: "already_voted",
      message: "You have already voted. Each person can vote only once.",
    };
  }

  return {
    ok: true,
    code: "success",
    message: "Your vote has been successfully submitted.",
  };
}

export function canStudentEditProject(params: {
  actorStudentId: string | null;
  projectStudentId: string | null;
  approvalStatus: ApprovalStatus;
  isAdmin: boolean;
}): boolean {
  if (params.isAdmin) return true;
  if (!params.actorStudentId || !params.projectStudentId) return false;
  if (params.actorStudentId !== params.projectStudentId) return false;
  return params.approvalStatus === "PENDING";
}

export function canAccessAdmin(role: string | null | undefined): boolean {
  return role === "admin";
}

export function publicCanSeeProject(status: ApprovalStatus): boolean {
  return status === "APPROVED";
}

export function publicContactFieldsBlocked(): readonly string[] {
  return ["contact_number", "whatsapp_number", "guardian_name", "guardian_contact"];
}

export const VOTE_MESSAGES: Record<VoteResultCode, string> = {
  success: "Your vote has been successfully submitted.",
  already_voted: "You have already voted. One Google account can vote for only one project.",
  disabled: "Voting is currently closed.",
  not_started: "Voting has not started yet.",
  ended: "Voting has ended.",
  unavailable: "This project is not currently available for voting.",
  unauthorized: "You don't have permission to perform this action.",
  unauthenticated: "You must sign in with Google to vote.",
  rate_limited: "Too many attempts. Please wait a moment and try again.",
  turnstile: "Verification failed. Please try again.",
};

export function inferClassGroup(className: string | null | undefined): "A" | "B" {
  const raw = (className ?? "").trim();
  const digits = raw.match(/(\d+)/);
  if (digits) {
    const n = parseInt(digits[1], 10);
    return n <= 5 ? "A" : "B";
  }
  if (/পঞ্চম|চতুর্থ|তৃতীয়|দ্বিতীয়|প্রথম|nursery|kg|prep|প্রাথমিক/i.test(raw)) return "A";
  return "B";
}

export function mapVoteCode(code: string | undefined): VoteResultCode {
  if (code && code in VOTE_MESSAGES) return code as VoteResultCode;
  return "unauthorized";
}
