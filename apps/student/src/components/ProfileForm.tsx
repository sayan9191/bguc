"use client";

import { useState } from "react";
import type { Student } from "@exhibition/database";
import { inferClassGroup, normalizeIndianMobile, parseSchoolClass } from "@exhibition/database";
import { Alert, Button, ClassSelect, Input, Label, PageLoader, useT } from "@exhibition/ui";
import { supabaseBrowser } from "@/lib/supabase/client";

export function ProfileForm({ student, locked = false }: { student: Student; locked?: boolean }) {
  const t = useT();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mobile, setMobile] = useState((student.contact_number ?? "").replace(/\D/g, "").slice(0, 10));

  async function save(formData: FormData) {
    setBusy(true);
    setError(null);
    setOk(false);
    if (locked) {
      setError(t("profileLock"));
      setBusy(false);
      return;
    }
    const klass = parseSchoolClass(String(formData.get("class_name") ?? ""));
    if (!klass) {
      setError(t("classRange"));
      setBusy(false);
      return;
    }
    const phone = normalizeIndianMobile(mobile);
    if (!phone) {
      setError(t("mobileInvalid"));
      setBusy(false);
      return;
    }
    const { error: err } = await supabaseBrowser()
      .from("students")
      .update({
        student_names: String(formData.get("student_names")),
        class_name: String(klass),
        class_group: inferClassGroup(String(klass)),
        school_name: String(formData.get("school_name")),
        contact_number: phone,
        mentor_name: String(formData.get("mentor_name") ?? "").trim() || null,
      })
      .eq("id", student.id);
    setBusy(false);
    if (err) setError(err.message);
    else setOk(true);
  }

  return (
    <form action={save} className="space-y-4">
      {busy ? <PageLoader label={t("saving")} /> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}
      {ok ? <Alert tone="success">{t("saved")}</Alert> : null}
      {locked ? <Alert>{t("profileLock")}</Alert> : null}
      <div>
        <Label>{t("name")}</Label>
        <Input name="student_names" defaultValue={student.student_names} required disabled={locked} />
      </div>
      <div>
        <Label>{t("classLabel")}</Label>
        <ClassSelect
          name="class_name"
          emptyLabel={t("selectClass")}
          defaultValue={parseSchoolClass(student.class_name)?.toString() ?? ""}
          required
          disabled={locked}
        />
      </div>
      <div>
        <Label>{t("school")}</Label>
        <Input name="school_name" defaultValue={student.school_name} disabled={locked} />
      </div>
      <div>
        <Label>{t("mentor")}</Label>
        <Input name="mentor_name" defaultValue={student.mentor_name ?? ""} disabled={locked} />
      </div>
      <div>
        <Label>{t("mobile")}</Label>
        <Input
          name="contact_number"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          maxLength={10}
          pattern="[6-9][0-9]{9}"
          value={mobile}
          onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
          required
          disabled={locked}
        />
      </div>
      {locked ? null : (
        <Button type="submit" disabled={busy}>
          Save
        </Button>
      )}
    </form>
  );
}
