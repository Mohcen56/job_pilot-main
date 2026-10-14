import { notFound } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { AISettingsForm } from "@/components/admin/AISettingsForm";
import { AINotice } from "@/components/feedback/AINotice";
import { requireUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { getAISettings } from "@jobhunt/api/ai/settings";
import { getProviderStatuses } from "@jobhunt/api/ai/config";

export default async function AdminPage() {
  const user = await requireUser();
  if (!(await isAdmin(user.id))) notFound();
  const settings = await getAISettings().catch(() => null);

  return (
    <>
      <Navbar isAuthenticated isAdmin />
      <main id="main-content" tabIndex={-1} className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[1100px] flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-accent-muted px-3 py-1 text-xs font-medium text-accent">
            <ShieldCheck aria-hidden="true" className="h-4 w-4" />
            Admin access
          </span>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-text-primary">
            AI settings
          </h1>
          <p className="mt-2 text-sm leading-6 text-text-secondary">
            Manage the AI behind JobHunt EZ from one place.
          </p>
        </div>
        {settings ? (
          <AISettingsForm
            settings={settings}
            providers={getProviderStatuses()}
          />
        ) : (
          <AINotice
            failure={{
              error:
                "AI settings could not be loaded. Please refresh and try again.",
            }}
          />
        )}
      </main>
    </>
  );
}
