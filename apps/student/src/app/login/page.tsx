"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, Input, Label, PageHeader, PageLoader, PasswordInput, useT } from "@exhibition/ui";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function LoginPage() {
  const t = useT();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await supabaseBrowser().auth.signInWithPassword({ email, password });
    if (err) {
      setBusy(false);
      setError(err.message);
      return;
    }
    router.push("/project");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-md">
      {busy ? <PageLoader label={t("signingIn")} /> : null}
      <PageHeader title={t("studentSignIn")} subtitle={t("studentSignInBody")} />
      <Card>
        <form className="space-y-4" onSubmit={onSubmit}>
          {error ? <Alert tone="error">{error}</Alert> : null}
          <div>
            <Label>{t("email")}</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <Label>{t("password")}</Label>
            <PasswordInput
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              showLabel={t("show")}
              hideLabel={t("hide")}
              required
            />
          </div>
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? t("signingIn") : t("signIn")}
          </Button>
        </form>
        <p className="mt-4 text-sm text-cream-200/70">
          {t("newParticipant")}{" "}
          <Link className="text-gold-300" href="/register">
            {t("createAccount")}
          </Link>
        </p>
      </Card>
    </div>
  );
}
