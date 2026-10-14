"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Search } from "lucide-react";
import { AINotice } from "@/components/feedback/AINotice";
import type { AIFailure } from "@jobhunt/shared/ai";

import type { CompanyResearchDossier } from "@jobhunt/shared/types";

type Props = {
  jobId: string;
};

export function ResearchCompanyButton({ jobId }: Props) {
  const router = useRouter();
  const [error, setError] = useState<AIFailure | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleClick(): void {
    setError(null);
    setSuccess(false);

    startTransition(async () => {
      try {
        const res = await fetch("/api/agent/research", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId }),
        });
        const json = (await res.json()) as {
          success: boolean;
          data?: { dossier: CompanyResearchDossier };
          error?: string;
          code?: AIFailure["code"];
          provider?: AIFailure["provider"];
          retryAfterSeconds?: number;
        };

        if (!res.ok || !json.success) {
          setError({
            ...json,
            success: false,
            error:
              json.error ??
              "Company research could not be completed. Please try again.",
          });
          return;
        }

        setSuccess(true);
        router.refresh();
      } catch {
        setError({
          success: false,
          error: "Network error. Please check your connection and try again.",
        });
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <button
        type="button"
        disabled={isPending}
        onClick={handleClick}
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        <Search className="h-4 w-4" />
        {isPending ? "Researching..." : "Research Company"}
      </button>
      {error && (
        <div className="w-full max-w-md">
          <AINotice failure={error} />
        </div>
      )}
      {success && (
        <p className="max-w-xs text-xs text-success">
          Research saved. Refreshing details...
        </p>
      )}
    </div>
  );
}
