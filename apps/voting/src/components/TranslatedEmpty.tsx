"use client";

import { EmptyState, useT } from "@exhibition/ui";

export function TranslatedEmpty({ kind }: { kind: "projects" | "results" | "media" }) {
  const t = useT();
  if (kind === "results") {
    return <EmptyState title={t("resultsHidden")} body={t("resultsHiddenBody")} />;
  }
  if (kind === "media") {
    return <EmptyState title={t("noPhotos")} body={t("noPhotos")} />;
  }
  return <EmptyState title={t("noProjects")} body={t("noProjectsBody")} />;
}
