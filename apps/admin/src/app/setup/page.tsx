import { PageHeader } from "@exhibition/ui";

export default function AdminSetupPage() {
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        title="Admin setup"
        subtitle="Add SUPABASE_SERVICE_ROLE_KEY to apps/admin/.env.local, then restart the admin site."
      />
      <p className="text-sm text-cream-200/80">
        Open the file <code>apps/admin/.env.local</code> in this project. Put the service role key on the line that starts with SUPABASE_SERVICE_ROLE_KEY. Then run:
      </p>
      <pre className="mt-4 overflow-x-auto rounded-xl border border-gold-500/20 bg-ink-900 p-4 text-sm text-gold-200">
        npm run dev:admin
      </pre>
    </div>
  );
}
