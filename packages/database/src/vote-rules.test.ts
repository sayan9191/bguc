import { describe, expect, it } from "vitest";
import {
  canAccessAdmin,
  canStudentEditProject,
  evaluateVoteAttempt,
  evaluateVotingWindow,
  inferClassGroup,
  publicCanSeeProject,
  publicContactFieldsBlocked,
} from "./vote-rules";

const settingsOpen = {
  voting_enabled: true,
  voting_start: "2026-01-01T00:00:00.000Z",
  voting_end: "2026-12-31T00:00:00.000Z",
};

const now = new Date("2026-09-11T00:00:00.000Z");
const user = "user-1";
const project = { id: "proj-a", approval_status: "APPROVED" as const };

describe("voting window", () => {
  it("is disabled when voting_enabled is false", () => {
    expect(evaluateVotingWindow({ ...settingsOpen, voting_enabled: false }, now)).toBe("disabled");
  });

  it("is not_started before voting_start", () => {
    expect(
      evaluateVotingWindow({ ...settingsOpen, voting_start: "2026-10-01T00:00:00.000Z" }, now)
    ).toBe("not_started");
  });

  it("is ended after voting_end", () => {
    expect(evaluateVotingWindow({ ...settingsOpen, voting_end: "2026-08-01T00:00:00.000Z" }, now)).toBe(
      "ended"
    );
  });
});

describe("evaluateVoteAttempt", () => {
  it("allows a first vote for an approved project", () => {
    const result = evaluateVoteAttempt({
      authenticatedUserId: user,
      existingVoteProjectId: null,
      project,
      settings: settingsOpen,
      now,
    });
    expect(result.ok).toBe(true);
    expect(result.code).toBe("success");
  });

  it("rejects a second vote from the same user", () => {
    const result = evaluateVoteAttempt({
      authenticatedUserId: user,
      existingVoteProjectId: "proj-a",
      project,
      settings: settingsOpen,
      now,
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("already_voted");
  });

  it("rejects a vote for a different project after already voting", () => {
    const result = evaluateVoteAttempt({
      authenticatedUserId: user,
      existingVoteProjectId: "proj-a",
      project: { id: "proj-b", approval_status: "APPROVED" },
      settings: settingsOpen,
      now,
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("already_voted");
  });

  it("simultaneous duplicate attempts: unique voter_id means only the empty existing vote succeeds", () => {
    const first = evaluateVoteAttempt({
      authenticatedUserId: user,
      existingVoteProjectId: null,
      project,
      settings: settingsOpen,
      now,
    });
    const second = evaluateVoteAttempt({
      authenticatedUserId: user,
      existingVoteProjectId: "proj-a",
      project,
      settings: settingsOpen,
      now,
    });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    expect(second.code).toBe("already_voted");
  });

  it("rejects votes for non-approved projects", () => {
    const pending = evaluateVoteAttempt({
      authenticatedUserId: user,
      existingVoteProjectId: null,
      project: { id: "proj-p", approval_status: "PENDING" },
      settings: settingsOpen,
      now,
    });
    const rejected = evaluateVoteAttempt({
      authenticatedUserId: user,
      existingVoteProjectId: null,
      project: { id: "proj-r", approval_status: "REJECTED" },
      settings: settingsOpen,
      now,
    });
    expect(pending.code).toBe("unavailable");
    expect(rejected.code).toBe("unavailable");
  });

  it("prevents votes when voting is disabled", () => {
    const result = evaluateVoteAttempt({
      authenticatedUserId: user,
      existingVoteProjectId: null,
      project,
      settings: { ...settingsOpen, voting_enabled: false },
      now,
    });
    expect(result.code).toBe("disabled");
  });

  it("prevents votes outside the configured time window", () => {
    const early = evaluateVoteAttempt({
      authenticatedUserId: user,
      existingVoteProjectId: null,
      project,
      settings: { ...settingsOpen, voting_start: "2026-10-01T00:00:00.000Z" },
      now,
    });
    const late = evaluateVoteAttempt({
      authenticatedUserId: user,
      existingVoteProjectId: null,
      project,
      settings: { ...settingsOpen, voting_end: "2026-08-01T00:00:00.000Z" },
      now,
    });
    expect(early.code).toBe("not_started");
    expect(late.code).toBe("ended");
  });
});

describe("authorization", () => {
  it("does not allow a student to edit another student's project", () => {
    expect(
      canStudentEditProject({
        actorStudentId: "stu-1",
        projectStudentId: "stu-2",
        approvalStatus: "PENDING",
        isAdmin: false,
      })
    ).toBe(false);
  });

  it("allows a student to edit their own pending project", () => {
    expect(
      canStudentEditProject({
        actorStudentId: "stu-1",
        projectStudentId: "stu-1",
        approvalStatus: "PENDING",
        isAdmin: false,
      })
    ).toBe(true);
  });

  it("locks student edits after approval", () => {
    expect(
      canStudentEditProject({
        actorStudentId: "stu-1",
        projectStudentId: "stu-1",
        approvalStatus: "APPROVED",
        isAdmin: false,
      })
    ).toBe(false);
  });

  it("blocks normal users from the admin panel", () => {
    expect(canAccessAdmin("voter")).toBe(false);
    expect(canAccessAdmin("student")).toBe(false);
    expect(canAccessAdmin("admin")).toBe(true);
  });

  it("only approved projects are public", () => {
    expect(publicCanSeeProject("APPROVED")).toBe(true);
    expect(publicCanSeeProject("PENDING")).toBe(false);
    expect(publicCanSeeProject("REJECTED")).toBe(false);
  });

  it("lists private contact fields that must never be queried by the voting app", () => {
    expect(publicContactFieldsBlocked()).toEqual([
      "contact_number",
      "whatsapp_number",
      "guardian_name",
      "guardian_contact",
    ]);
  });
});

describe("class groups", () => {
  it("maps class 5 and below to Group A", () => {
    expect(inferClassGroup("Class 4")).toBe("A");
    expect(inferClassGroup("5")).toBe("A");
  });

  it("maps class 6 and above to Group B", () => {
    expect(inferClassGroup("Class 7")).toBe("B");
    expect(inferClassGroup("9")).toBe("B");
  });
});
