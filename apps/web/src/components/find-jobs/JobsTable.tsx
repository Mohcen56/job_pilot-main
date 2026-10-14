import Link from "next/link";
import { Building2 } from "lucide-react";

import { getMatchScoreColor, getMatchScoreTextColor, formatDate } from "@/lib/utils";
import type { Job } from "@jobhunt/shared/types";
import { JobSource, isDirectJob } from './JobSource';

type Props = {
  jobs: Job[];
  isLoading?: boolean;
};

function MatchScoreBar({ score }: { score: number }) {
  const fillColor = getMatchScoreColor(score);
  const textColor = getMatchScoreTextColor(score);

  return (
    <div className="flex items-center gap-3">
      <div className="h-1 w-24 overflow-hidden rounded-full bg-border-light">
        <div
          className={`h-full rounded-full ${fillColor}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={`text-sm font-medium ${textColor}`}>{score}%</span>
    </div>
  );
}

export function JobsTable({ jobs, isLoading = false }: Props) {
  if (jobs.length === 0 && !isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-surface shadow-card">
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-20">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-secondary">
            <Building2 className="h-6 w-6 text-text-muted" />
          </div>
          <p className="text-sm text-text-muted">No jobs found yet. Run a search to get started.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border border-border bg-surface shadow-card overflow-x-auto transition-opacity ${isLoading ? "opacity-60" : "opacity-100"}`}>
      <div className="divide-y divide-border sm:hidden">
        {jobs.map(job => <article key={job.id} className="space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <JobSource job={job} />
            <span className="text-xs font-medium text-text-secondary">{job.match_score === null ? 'Match pending' : `${job.match_score}% match`}</span>
          </div>
          <Link href={`/find-jobs/${job.id}`} className="block">
            <p className="text-sm font-semibold text-text-primary">{job.title}</p>
            <p className="mt-1 text-sm text-text-secondary">{job.company}</p>
          </Link>
          <p className="text-xs text-text-secondary">{job.location || 'Location unknown'} · {job.workplace_type || 'unknown'}</p>
          {job.workplace_type === 'remote' && job.geographic_eligibility?.status === 'unknown' && <p className="text-xs text-warning">Remote eligibility unknown</p>}
          <p className="text-xs text-text-secondary">{job.published_at ? `Posted ${formatDate(job.published_at)}` : 'Posted date unknown'}</p>
          <p className="text-xs text-text-muted">Discovered {formatDate(job.found_at)}</p>
          <a href={job.external_apply_url ?? job.source_url ?? '#'} target="_blank" rel="noreferrer" className="inline-block text-sm font-medium text-accent hover:underline">{isDirectJob(job) ? 'Apply on company website' : 'Open application'}</a>
        </article>)}
      </div>
      <table className="hidden w-full sm:table">
        <thead>
          <tr className="border-b border-border">
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-secondary">
              Company
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-secondary">
              Role
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-secondary">
              Match Score
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-secondary">
              Salary Est.
            </th>
            <th className="hidden px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-secondary sm:table-cell">
              Source
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-secondary">
              Posted / Discovered
            </th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job, index) => (
            <tr
              key={job.id}
              className={`group cursor-pointer hover:bg-surface-secondary ${
                index < jobs.length - 1 ? "border-b border-border" : ""
              }`}
            >
              <td className="px-6 py-4">
                <Link href={`/find-jobs/${job.id}`} className="flex items-center gap-3">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-border bg-surface-secondary">
                    <Building2 className="h-4 w-4 text-text-muted" />
                  </div>
                  <span className="text-sm font-medium text-text-primary">
                    {job.company ?? "—"}
                  </span>
                </Link>
              </td>
              <td className="px-6 py-4">
                <Link href={`/find-jobs/${job.id}`} className="block">
                  <span className="text-sm text-text-primary">{job.title ?? "—"}</span>
                  <span className="mt-1 block text-xs text-text-secondary">{job.location || "Location unknown"} · {job.workplace_type || "unknown"}</span>
                  {job.workplace_type === "remote" && job.geographic_eligibility?.status === "unknown" && <span className="block text-xs text-warning">Remote eligibility unknown</span>}
                </Link>
                <a href={job.external_apply_url ?? job.source_url ?? '#'} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs font-medium text-accent hover:underline">{isDirectJob(job) ? 'Apply on company website' : 'Open application'}</a>
              </td>
              <td className="px-6 py-4">
                <Link href={`/find-jobs/${job.id}`} className="block">
                  {job.match_score !== null ? (
                    <MatchScoreBar score={job.match_score} />
                  ) : (
                    <span className="text-sm text-text-muted">Match pending</span>
                  )}
                </Link>
              </td>
              <td className="px-6 py-4">
                <Link href={`/find-jobs/${job.id}`} className="block">
                  <span className="text-sm text-text-primary">{job.salary ?? "—"}</span>
                </Link>
              </td>
              <td className="hidden px-6 py-4 sm:table-cell">
                <Link href={`/find-jobs/${job.id}`} className="block">
                  <JobSource job={job} />
                </Link>
              </td>
              <td className="px-6 py-4">
                <Link href={`/find-jobs/${job.id}`} className="block">
                  <span className="block text-sm text-text-secondary">{job.published_at ? formatDate(job.published_at) : 'Posted date unknown'}</span>
                  <span className="block text-xs text-text-muted">Discovered {formatDate(job.found_at)}</span>
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
