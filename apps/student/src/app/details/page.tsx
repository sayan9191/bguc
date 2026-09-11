"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { inferClassGroup, normalizeIndianMobile, parseSchoolClass } from "@exhibition/database";
import { Alert, Button, Card, ClassSelect, Input, Label, PageHeader, PageLoader, useT } from "@exhibition/ui";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function DetailsPage() {
  const t = useT();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mobile, setMobile] = useState("");

  async function save(formData: FormData) {
    const klass = parseSchoolClass(String(formData.get("class") ?? ""));
    if (!klass) {
      setError(t("classRange"));
      return;
    }
    const phone = normalizeIndianMobile(mobile);
    if (!phone) {
      setError(t("mobileInvalid"));
      return;
    }
    setBusy(true);
    setError(null);
    const mentor = String(formData.get("mentor") ?? "").trim();
    const supabase = supabaseBrowser();
    const { data, error: err } = await supabase.rpc("register_new_student", {
      p_student_names: String(formData.get("names") ?? ""),
      p_class_name: String(klass),
      p_school_name: String(formData.get("school") ?? ""),
      p_contact: phone,
      p_whatsapp: "",
      p_guardian_name: "",
      p_guardian_contact: "",
    });
    if (err) {
      setBusy(false);
      setError(err.message);
      return;
    }
    const result = data as { ok?: boolean };
    if (!result?.ok) {
      setBusy(false);
      setError(t("saveFail"));
      return;
    }
    await supabase
      .from("students")
      .update({
        class_name: String(klass),
        class_group: inferClassGroup(String(klass)),
        mentor_name: mentor || null,
      })
      .eq("profile_id", (await supabase.auth.getUser()).data.user?.id ?? "");
    router.push("/project/new");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-md">
      {busy ? <PageLoader label={t("saving")} /> : null}
      <PageHeader title={t("yourDetails")} subtitle={t("detailsBody")} />
      <Card>
        <form className="space-y-4" action={save}>
          {error ? <Alert tone="error">{error}</Alert> : null}
          <div>
            <Label>{t("yourName")}</Label>
            <Input name="names" required />
          </div>
          <div>
            <Label>{t("classLabel")}</Label>
            <ClassSelect name="class" emptyLabel={t("selectClass")} required />
          </div>
          <div>
            <Label>{t("school")}</Label>
            <Input name="school" required />
          </div>
          <div>
            <Label>{t("mentor")}</Label>
            <Input name="mentor" />
          </div>
          <div>
            <Label>{t("mobile")}</Label>
            <Input
              name="contact"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              maxLength={10}
              pattern="[6-9][0-9]{9}"
              value={mobile}
              onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
              required
            />
          </div>
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? t("saving") : t("continue")}
          </Button>
        </form>
      </Card>
    </div>
  );
}
