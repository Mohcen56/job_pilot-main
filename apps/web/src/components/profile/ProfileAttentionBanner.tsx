import Link from "next/link";
import { CircleUserRound, ArrowUpRight } from "lucide-react";
import type { MissingField } from "@jobhunt/shared/types";

type Props = {
  completionPercent: number;
  missingFields: MissingField[];
};

export function ProfileAttentionBanner({
  completionPercent,
  missingFields,
}: Props) {
  if (completionPercent === 100) return null;

  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset =
    circumference - (completionPercent / 100) * circumference;

  return (
    <section className="flex items-start justify-between gap-4 sm:gap-6 rounded-2xl border border-border bg-surface p-6 shadow-card">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <CircleUserRound aria-hidden="true" className="h-5 w-5 text-accent" />
          <h2 className="text-sm font-semibold text-text-primary">
            A stronger profile. Better matches.
          </h2>
        </div>

        <p className="mt-1 text-sm text-text-secondary">
          Add a few details to help your matches and tailored resumes reflect you.
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          {missingFields.map((field) => (
            <span
              key={field}
              className="rounded-md border border-border bg-surface-secondary px-2 py-1 text-xs font-medium text-text-secondary"
            >
              {field}
            </span>
          ))}
        </div>
        <Link href="/profile" className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-accent hover:underline">Complete your profile <ArrowUpRight aria-hidden="true" className="h-4 w-4" /></Link>
      </div>

      <div className="relative hidden h-[88px] w-[88px] flex-shrink-0 sm:block">
        <svg width="88" height="88" viewBox="0 0 88 88" aria-hidden="true">
          <circle
            cx="44"
            cy="44"
            r={radius}
            fill="none"
            stroke="var(--color-border)"
            strokeWidth="8"
          />
          <circle
            cx="44"
            cy="44"
            r={radius}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            transform="rotate(-90 44 44)"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-semibold leading-none text-text-primary">
            {completionPercent}%
          </span>
        </div>
      </div>
    </section>
  );
}
