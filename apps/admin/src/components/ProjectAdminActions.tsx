"use client";

import { useState } from "react";
import type { Project, ProjectMember } from "@exhibition/database";
import { parseSchoolClass } from "@exhibition/database";
import { Alert, Button, ClassSelect, Input, Label, Textarea } from "@exhibition/ui";
import { deleteProject, saveProject, setProjectStatus } from "@/app/actions";

export function ProjectAdminActions({ project, members }: { project: Project; members: ProjectMember[] }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSave(formData: FormData) {
    setBusy(true);
    setError(null);
    const result = await saveProject(formData);
    setBusy(false);
    if (result?.error) setError(result.error);
  }

  return (
    <div className="space-y-6">
      {error ? <Alert tone="error">{error}</Alert> : null}
      {project.approval_status === "APPROVED" ? (
        <Alert>
          Approved. The student cannot change their profile or project. You can still edit here if needed.
        </Alert>
      ) : (
        <Alert>When you approve, the student will not be able to change their profile or project.</Alert>
      )}
      <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:gap-3">
        <form action={setProjectStatus} className="sm:inline">
          <input type="hidden" name="id" value={project.id} />
          <input type="hidden" name="status" value="APPROVED" />
          <Button type="submit" disabled={busy} className="w-full sm:w-auto">
            Approve
          </Button>
        </form>
        <form action={setProjectStatus} className="sm:inline">
          <input type="hidden" name="id" value={project.id} />
          <input type="hidden" name="status" value="REJECTED" />
          <input type="hidden" name="reason" value="Does not meet exhibition guidelines" />
          <Button type="submit" variant="danger" disabled={busy} className="w-full sm:w-auto">
            Reject
          </Button>
        </form>
        <form action={setProjectStatus} className="sm:inline">
          <input type="hidden" name="id" value={project.id} />
          <input type="hidden" name="status" value="PENDING" />
          <Button type="submit" variant="secondary" disabled={busy} className="w-full sm:w-auto">
            Reset to pending
          </Button>
        </form>
        <form
          className="sm:inline"
          action={deleteProject}
          onSubmit={(e) => {
            if (!confirm("Delete this project permanently?")) e.preventDefault();
          }}
        >
          <input type="hidden" name="id" value={project.id} />
          <Button type="submit" variant="ghost" disabled={busy} className="w-full sm:w-auto">
            Delete
          </Button>
        </form>
      </div>
      <form action={onSave} className="surface-card space-y-3 p-4 sm:p-5">
        <input type="hidden" name="id" value={project.id} />
        <Label>Project name</Label>
        <Input name="model_name" defaultValue={project.model_name} />
        <Label>Group</Label>
        <select name="class_group" defaultValue={project.class_group ?? "B"} className="min-h-11 w-full rounded-xl border border-gold-500/20 bg-ink-950 px-3 py-2">
          <option value="A">Group A — upto class 5</option>
          <option value="B">Group B — class 6 onwards</option>
        </select>
        <Label>Description</Label>
        <Textarea name="description" defaultValue={project.description ?? ""} />
        <Label>School</Label>
        <Input name="school_name" defaultValue={project.school_name ?? ""} />
        <Label>Class</Label>
        <ClassSelect name="class_name" defaultValue={parseSchoolClass(project.class_name ?? "")?.toString() ?? ""} required />
        <Label>Lead student</Label>
        <Input name="lead_name" defaultValue={members[0]?.student_name ?? project.team_display_names?.split(",")[0]?.trim() ?? ""} />
        <Label>Other members</Label>
        {Array.from({ length: 4 }).map((_, i) => {
          const extras = (project.team_display_names ?? "")
            .split(",")
            .map((n) => n.trim())
            .filter(Boolean)
            .slice(1);
          return <Input key={i} name="member_extra" className="mt-2" defaultValue={extras[i] ?? ""} placeholder={`Member ${i + 2}`} />;
        })}
        <Label>Guidance / mentor name</Label>
        <Input name="mentor_name" defaultValue={project.mentor_name ?? ""} />
        <Label>Video URL</Label>
        <Input name="video_url" defaultValue={project.video_url ?? ""} />
        <Label>Replace cover image</Label>
        <Input name="cover" type="file" accept="image/*" />
        <Button type="submit" disabled={busy} className="w-full sm:w-auto">
          Save edits
        </Button>
      </form>
    </div>
  );
}
