"use client";

import { Search, Loader2 } from "lucide-react";
import { useState } from "react";
import { CountrySelect } from "../ui/CountrySelect";

type Props = {
  onSearch: (jobTitle: string, location: string, country: string) => void;
  isSearching: boolean;
  successMessage: string | null;
  onProfileSearch: () => void;
};

export function SearchControls({ onSearch, onProfileSearch, isSearching, successMessage }: Props) {
  const [jobTitle, setJobTitle] = useState("");
  const [country, setCountry] = useState("");
  const [location, setLocation] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!jobTitle.trim() || !country) return;
    onSearch(jobTitle.trim(), location.trim(), country);
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-6 shadow-[0px_1px_3px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)]">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-5">
        <div>
          <h2 className="text-base font-semibold text-text-primary">Search with your saved preferences</h2>
          <p className="mt-1 text-sm text-text-secondary">Use your saved roles, locations and job boards. Add Remote in Profile to include remote jobs.</p>
          <a href="/profile" className="mt-1 inline-block text-sm font-medium text-accent hover:underline">Edit search preferences</a>
        </div>
        <button type="button" onClick={onProfileSearch} disabled={isSearching} className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-dark focus-visible:outline-accent disabled:opacity-60">
          {isSearching ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Search className="h-4 w-4" aria-hidden="true" />}
          Search using my profile
        </button>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium uppercase tracking-wide text-text-secondary">
              <span id="job-title-label">Job Title</span>
            </label>
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
                aria-hidden="true"
              />
              <input
                type="text"
                aria-labelledby="job-title-label"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="Frontend Engineer"
                className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium uppercase tracking-wide text-text-secondary">
              <span id="job-location-label">City (optional) or Remote</span>
            </label>
            <input
              type="text"
              aria-labelledby="job-location-label"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Any city, or type Remote"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
            />
          </div>

          <CountrySelect id="search-country" value={country} onChange={setCountry} disabled={isSearching} />

          <div className="flex items-end">
            <button
              type="submit"
              disabled={isSearching || !jobTitle.trim() || !country}
              className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {isSearching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              Find Jobs
            </button>
          </div>
        </div>

        {successMessage && (
          <div role="status" className="mt-4 flex items-center gap-2 rounded-lg border border-success-light bg-success-lightest px-4 py-2.5">
            <span className="text-base">✨</span>
            <p className="text-sm font-medium text-success-foreground">{successMessage}</p>
          </div>
        )}
      </form>
    </div>
  );
}
