"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { AINotice } from "@/components/feedback/AINotice";
import type { AIFailure } from "@jobhunt/shared/ai";

import { SearchControls } from "@/components/find-jobs/SearchControls";
import {
  JobFilters,
  type MatchFilter,
  type SortOption,
  type FreshnessFilter,
} from "@/components/find-jobs/JobFilters";
import { JobsTable } from "@/components/find-jobs/JobsTable";
import { JobsPagination } from "@/components/find-jobs/JobsPagination";
import type { Job } from "@jobhunt/shared/types";

const PAGE_SIZE = 20;

type Props = {
  initialJobs: Job[];
  initialTotalCount: number;
};

export function FindJobsClient({ initialJobs, initialTotalCount }: Props) {
  const [jobs, setJobs] = useState<Job[]>(initialJobs);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [isSearching, setIsSearching] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [failure, setFailure] = useState<AIFailure | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [filterSearch, setFilterSearch] = useState("");
  const [matchFilter, setMatchFilter] = useState<MatchFilter>("all");
  const [sortOption, setSortOption] = useState<SortOption>("score");
  const [freshness, setFreshness] = useState<FreshnessFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const requestRef = useRef<AbortController | null>(null);

  const fetchJobs = useCallback(
    async (
      search: string,
      match: MatchFilter,
      sort: SortOption,
      page: number,
    ) => {
      requestRef.current?.abort();
      const controller = new AbortController();
      requestRef.current = controller;
      setIsFetching(true);
      try {
        const params = new URLSearchParams({
          search,
          matchFilter: match,
          sortOption: sort,
          page: String(page),
          freshnessDays: freshness,
        });
        const res = await fetch(`/api/jobs?${params.toString()}`, { signal: controller.signal });
        const json = (await res.json()) as {
          success: boolean;
          data?: { jobs: Job[]; totalCount: number; page: number };
          error?: string;
        };
        if (json.success && json.data && !controller.signal.aborted) {
          setJobs(json.data.jobs);
          setTotalCount(json.data.totalCount);
        }
      } catch {
        // silently keep existing results on network error
      } finally {
        if (requestRef.current === controller) setIsFetching(false);
      }
    },
    [freshness],
  );

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void fetchJobs(filterSearch, matchFilter, sortOption, currentPage);
    });
    return () => { active = false; requestRef.current?.abort(); };
  }, [filterSearch, matchFilter, sortOption, currentPage, fetchJobs]);

  async function handleSearch(jobTitle?: string, location?: string, country?: string) {
    setIsSearching(true);
    setSuccessMessage(null);
    setFailure(null);
    setWarnings([]);
    try {
      const res = await fetch("/api/agent/find", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(jobTitle === undefined ? { mode: "profile" } : { mode: "manual", jobTitle, location: location ?? "", country }), ...(freshness === "all" ? {} : { freshnessDays: Number(freshness) }) }),
      });
      const json = (await res.json()) as {
        success: boolean;
        data?: { jobs: Job[]; successMessage: string; warnings?: string[] };
        error?: string;
        code?: AIFailure["code"];
        provider?: AIFailure["provider"];
        retryAfterSeconds?: number;
      };
      if (!res.ok || !json.success) {
        setFailure({
          ...json,
          success: false,
          error: json.error ?? "Something went wrong. Please try again.",
        });
        return;
      }
      if (json.data) {
        setSuccessMessage(json.data.successMessage);
        setWarnings(json.data.warnings ?? []);
        setCurrentPage(1);
        await fetchJobs(filterSearch, matchFilter, sortOption, 1);
      }
    } catch {
      setFailure({
        success: false,
        error: "Network error. Please check your connection and try again.",
      });
    } finally {
      setIsSearching(false);
    }
  }

  function handleFilterChange<T>(setter: (v: T) => void) {
    return (value: T) => {
      setter(value);
      setCurrentPage(1);
    };
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <SearchControls
        onSearch={handleSearch}
        onProfileSearch={() => { void handleSearch(); }}
        isSearching={isSearching}
        successMessage={successMessage}
      />
      {failure && <AINotice failure={failure} />}
      {warnings.length > 0 && <div role="status" className="rounded-lg border border-border bg-surface p-4 text-sm text-text-secondary">{warnings.map((warning) => <p key={warning}>{warning}</p>)}</div>}

      <div className="flex min-w-0 flex-col gap-4">
        <JobFilters
          search={filterSearch}
          onSearchChange={handleFilterChange(setFilterSearch)}
          matchFilter={matchFilter}
          onMatchFilterChange={handleFilterChange(setMatchFilter)}
          sortOption={sortOption}
          onSortOptionChange={handleFilterChange(setSortOption)}
          freshness={freshness}
          onFreshnessChange={handleFilterChange(setFreshness)}
        />

        <JobsTable jobs={jobs} isLoading={isFetching} />

        <JobsPagination
          currentPage={currentPage}
          totalCount={totalCount}
          pageSize={PAGE_SIZE}
          onPageChange={setCurrentPage}
        />

        {totalCount > 0 && (
          <p className="text-center text-xs text-text-muted">Company listings are preferred over duplicate aggregator results. Date filters use publication dates; unknown dates remain unknown. Remote eligibility may need confirmation.</p>
        )}
      </div>
    </div>
  );
}
