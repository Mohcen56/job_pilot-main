import { BriefcaseBusiness, ChartNoAxesColumnIncreasing, Building2, CalendarDays } from "lucide-react";

type Props = {
  totalJobs: number;
  avgMatchRate: number;
  companiesResearched: number;
  jobsThisWeek: number;
};

type StatCard = {
  label: string;
  value: string;
  trendLabel: string;
  Icon: typeof BriefcaseBusiness;
};

export function StatsBar({
  totalJobs,
  avgMatchRate,
  companiesResearched,
  jobsThisWeek,
}: Props) {
  const stats: StatCard[] = [
    { label: "Total Jobs Found", value: String(totalJobs), trendLabel: "Saved in your workspace", Icon: BriefcaseBusiness },
    { label: "Avg. Match Rate", value: `${avgMatchRate}%`, trendLabel: "Across saved jobs", Icon: ChartNoAxesColumnIncreasing },
    { label: "Companies Researched", value: String(companiesResearched), trendLabel: "Company dossiers ready", Icon: Building2 },
    { label: "Jobs This Week", value: String(jobsThisWeek), trendLabel: "Found in the last 7 days", Icon: CalendarDays },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-2xl border border-border bg-surface p-6 shadow-card"
        >
          <div className="flex items-center justify-between gap-3"><p className="text-sm font-medium text-text-secondary">{stat.label}</p><stat.Icon aria-hidden="true" className="h-4 w-4 text-accent" /></div>
          <p className="mt-5 text-4xl font-semibold leading-10 tracking-tight text-text-primary">
            {stat.value}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-text-muted">{stat.trendLabel}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
