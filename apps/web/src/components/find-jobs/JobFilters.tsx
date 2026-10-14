"use client";

import { Search, ChevronDown } from "lucide-react";

export type MatchFilter = "all" | "high" | "low";
export type SortOption = "score" | "newest" | "oldest";
export type FreshnessFilter = "all" | "1" | "3" | "7" | "14" | "30";

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  matchFilter: MatchFilter;
  onMatchFilterChange: (value: MatchFilter) => void;
  sortOption: SortOption;
  onSortOptionChange: (value: SortOption) => void;
  freshness: FreshnessFilter;
  onFreshnessChange: (value: FreshnessFilter) => void;
};

const MATCH_FILTER_LABELS: Record<MatchFilter, string> = {
  all: "All Matches",
  high: "High Match",
  low: "Low Match",
};

const SORT_LABELS: Record<SortOption, string> = {
  score: "Match Score",
  newest: "Recently posted",
  oldest: "Oldest posted",
};

export function JobFilters({
  search,
  onSearchChange,
  matchFilter,
  onMatchFilterChange,
  sortOption,
  onSortOptionChange,
  freshness,
  onFreshnessChange,
}: Props) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
          aria-hidden="true"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Filter by company or role..."
          className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Publication date filter" value={freshness} onChange={event => onFreshnessChange(event.target.value as FreshnessFilter)} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent">
          <option value="all">Any posted date</option>
          {[1,3,7,14,30].map(days => <option key={days} value={days}>{days === 1 ? "Past 24 hours" : `Past ${days} days`}</option>)}
        </select>
        <div className="relative">
          <select
            value={matchFilter}
            aria-label="Match filter"
            onChange={(e) => onMatchFilterChange(e.target.value as MatchFilter)}
            className="appearance-none rounded-lg border border-border bg-surface py-2 pl-3 pr-8 text-sm font-medium text-text-primary focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent cursor-pointer"
          >
            {(Object.keys(MATCH_FILTER_LABELS) as MatchFilter[]).map((key) => (
              <option key={key} value={key}>
                {MATCH_FILTER_LABELS[key]}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted"
            aria-hidden="true"
          />
        </div>

        <div className="relative">
          <select
            value={sortOption}
            aria-label="Sort jobs"
            onChange={(e) => onSortOptionChange(e.target.value as SortOption)}
            className="appearance-none rounded-lg border border-border bg-surface py-2 pl-3 pr-8 text-sm font-medium text-text-primary focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent cursor-pointer"
          >
            {(Object.keys(SORT_LABELS) as SortOption[]).map((key) => (
              <option key={key} value={key}>
                {SORT_LABELS[key]}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted"
            aria-hidden="true"
          />
        </div>
      </div>
    </div>
  );
}
