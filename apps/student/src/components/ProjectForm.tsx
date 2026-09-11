"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  inferClassGroup,
  PROJECT_DESC_MAX_WORDS,
  PROJECT_DESC_MIN_WORDS,
  PROJECT_MAX_PHOTOS,
  PROJECT_NAME_MAX_WORDS,
  wordCount,
  type Project,
  type Student,
} from "@exhibition/database";
import { Alert, Button, Card, Input, Label, PageLoader, Textarea, useLang, useT } from "@exhibition/ui";
import { supabaseBrowser } from "@/lib/supabase/client";

export function ProjectForm({
  student,
  project,
  existingPhotoCount = 0,
  photoUrls = [],
  locked = false,
}: {
  student: Student;
  project?: Project;
  existingPhotoCount?: number;
  photoUrls?: string[];
  locked?: boolean;
}) {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [description, setDescription] = useState(project?.description ?? "");
  const [name, setName] = useState(project?.model_name ?? "");
  const descWords = wordCount(description);
  const nameWords = wordCount(name);

  async function save(formData: FormData) {
    if (locked) {
      setError(t("approvedLock"));
      return;
    }
    const modelName = String(formData.get("model_name") ?? "");
    const about = String(formData.get("description") ?? "");
    if (!about.trim()) {
      setError(t("writeAbout"));
      return;
    }
    if (wordCount(modelName) > PROJECT_NAME_MAX_WORDS) {
      setError(
        lang === "bn"
          ? `প্রকল্পের নাম সর্বোচ্চ ${PROJECT_NAME_MAX_WORDS} শব্দ হতে পারে।`
          : `Project name must be ${PROJECT_NAME_MAX_WORDS} words or fewer.`
      );
      return;
    }
    if (wordCount(about) < PROJECT_DESC_MIN_WORDS || wordCount(about) > PROJECT_DESC_MAX_WORDS) {
      setError(
        lang === "bn"
          ? `বিবরণ ${PROJECT_DESC_MIN_WORDS} থেকে ${PROJECT_DESC_MAX_WORDS} শব্দের মধ্যে হতে হবে।`
          : `Project details must be between ${PROJECT_DESC_MIN_WORDS} and ${PROJECT_DESC_MAX_WORDS} words.`
      );
      return;
    }
    const files = (formData.getAll("photos") as File[]).filter((file) => file && file.size > 0);
    if (files.length > PROJECT_MAX_PHOTOS) {
      setError(
        lang === "bn"
          ? `সর্বোচ্চ ${PROJECT_MAX_PHOTOS}টি ছবি আপলোড করা যাবে।`
          : `You can upload at most ${PROJECT_MAX_PHOTOS} photos.`
      );
      return;
    }
    if (!project && files.length < 1) {
      setError(lang === "bn" ? "কমপক্ষে ১টি ছবি দিন (সর্বোচ্চ ৩টি)।" : "Add at least 1 photo (maximum 3).");
      return;
    }
    if (existingPhotoCount + files.length > PROJECT_MAX_PHOTOS) {
      setError(
        lang === "bn"
          ? `সর্বোচ্চ ${PROJECT_MAX_PHOTOS}টি ছবি। আপনার ইতিমধ্যে ${existingPhotoCount}টি আছে।`
          : `Maximum ${PROJECT_MAX_PHOTOS} photos. You already have ${existingPhotoCount}.`
      );
      return;
    }

    setBusy(true);
    setError(null);
    const supabase = supabaseBrowser();
    const extras = formData
      .getAll("member_extra")
      .map((v) => String(v).trim())
      .filter(Boolean);
    const team = [student.student_names, ...extras].filter(Boolean).join(", ");
    const { data, error: err } = await supabase.rpc("submit_student_project", {
      p_model_name: modelName.trim(),
      p_description: about.trim(),
      p_class_group: String(formData.get("class_group")) === "A" ? "A" : "B",
      p_team_display_names: team,
      p_project_id: project?.id ?? null,
      p_mentor_name: String(formData.get("mentor_name") ?? "").trim(),
    });
    const result = data as { ok?: boolean; project_id?: string; message?: string } | null;
    if (err || !result?.ok || !result.project_id) {
      setBusy(false);
      setError(err?.message || result?.message || "Could not save project.");
      return;
    }
    const projectId = result.project_id;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const path = `${projectId}/${crypto.randomUUID()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("project-images").upload(path, file, { upsert: true });
      if (upErr) {
        setBusy(false);
        setError(upErr.message);
        return;
      }
      const mediaUrl = `project-images/${path}`;
      const asCover = i === 0 && (!project?.cover_image_url || existingPhotoCount === 0);
      const { error: attachErr } = await supabase.rpc("attach_student_media", {
        p_project_id: projectId,
        p_media_url: mediaUrl,
        p_as_cover: asCover,
      });
      if (attachErr) {
        setBusy(false);
        setError(attachErr.message);
        return;
      }
    }

    setBusy(false);
    router.push("/project");
    router.refresh();
  }

  const remainingSlots = PROJECT_MAX_PHOTOS - existingPhotoCount;

  return (
    <Card className="mt-4">
      {busy ? <PageLoader label={t("saving")} /> : null}
      <form action={save} className="space-y-4">
        {error ? <Alert tone="error">{error}</Alert> : null}
        <div>
          <Label>{t("projectName")}</Label>
          <Input
            name="model_name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={locked}
          />
          <p className="mt-1 text-xs text-cream-200/60">
            {nameWords}/{PROJECT_NAME_MAX_WORDS} words
          </p>
        </div>
        <div>
          <Label>{t("group")}</Label>
          <select
            name="class_group"
            defaultValue={project?.class_group ?? inferClassGroup(student.class_name)}
            disabled={locked}
            className="min-h-11 w-full rounded-xl border border-gold-500/20 bg-ink-950/60 px-3.5 py-2.5"
          >
            <option value="A">{t("groupA")}</option>
            <option value="B">{t("groupB")}</option>
          </select>
        </div>
        <div>
          <Label>{t("description")}</Label>
          <Textarea
            name="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            disabled={locked}
          />
          <p className={`mt-1 text-xs ${descWords > PROJECT_DESC_MAX_WORDS || (descWords > 0 && descWords < PROJECT_DESC_MIN_WORDS) ? "text-red-300" : "text-cream-200/60"}`}>
            {descWords} words · write {PROJECT_DESC_MIN_WORDS}–{PROJECT_DESC_MAX_WORDS} words
          </p>
        </div>
        <div>
          <Label>{t("otherMembers")}</Label>
          {Array.from({ length: 4 }).map((_, i) => {
            const extras = (project?.team_display_names ?? "")
              .split(",")
              .map((n) => n.trim())
              .filter((n) => n && n !== student.student_names);
            return (
              <Input
                key={i}
                name="member_extra"
                className="mt-2"
                defaultValue={extras[i] ?? ""}
                disabled={locked}
                placeholder={`Member ${i + 2}`}
              />
            );
          })}
        </div>
        <div>
          <Label>{t("mentor")}</Label>
          <Input name="mentor_name" defaultValue={project?.mentor_name ?? student.mentor_name ?? ""} disabled={locked} />
        </div>
        <div>
          <Label>{t("photos")}</Label>
          <Input
            name="photos"
            type="file"
            accept="image/*"
            multiple
            disabled={locked || remainingSlots <= 0}
          />
          <p className="mt-1 text-xs text-cream-200/60">
            Maximum {PROJECT_MAX_PHOTOS} photos.
            {existingPhotoCount ? ` ${existingPhotoCount} already saved.` : " Add 1 to 3 photos."}
          </p>
          {photoUrls.length ? (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {photoUrls.map((url) => (
                <img key={url} src={url} alt="" className="h-24 w-full rounded-lg object-cover" />
              ))}
            </div>
          ) : null}
        </div>
        <Button type="submit" disabled={busy || locked}>
          {busy ? t("saving") : t("saveProject")}
        </Button>
      </form>
    </Card>
  );
}
