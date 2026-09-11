"use client";

import { Alert, Button, Card, PageHeader, useT } from "@exhibition/ui";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useState } from "react";

export default function LoginPage() {
  const t = useT();
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setError(null);
    const supabase = supabaseBrowser();
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/`,
        queryParams: { prompt: "select_account" },
      },
    });
    if (err) setError(err.message);
  }

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader kicker={t("exhibition")} title={t("googleSignInTitle")} subtitle={t("googleSignInBody")} />
      <Card className="space-y-4">
        {error ? <Alert tone="error">{error}</Alert> : null}
        <Button onClick={signIn} className="w-full">
          {t("continueGoogle")}
        </Button>
      </Card>
    </div>
  );
}
