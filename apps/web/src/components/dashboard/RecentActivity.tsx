import Link from "next/link";
import { ArrowUpRight, ScanSearch } from "lucide-react";

type ActivityType = "job_found" | "researched";

type ActivityItem = {
  id: string;
  text: string;
  time: string;
  type: ActivityType;
};

type Props = {
  items: ActivityItem[];
};

function ActivityDot({ type }: { type: ActivityType }) {
  if (type === "job_found") {
    return (
      <span
        className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full"
        style={{ background: "var(--color-success-light)" }}
      >
        <span
          className="h-2 w-2 rounded-full"
          style={{ background: "var(--color-success-alt)" }}
        />
      </span>
    );
  }
  return (
    <span
      className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full"
      style={{ background: "var(--color-info-light)" }}
    >
      <span
        className="h-2 w-2 rounded-full"
        style={{ background: "var(--color-info)" }}
      />
    </span>
  );
}

export function RecentActivity({ items }: Props) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-6 shadow-card">
      <h2 className="text-base font-semibold leading-6 text-text-primary">
        Recent Activity
      </h2>
      {items.length === 0 ? (
        <div className="flex min-h-[240px] flex-col items-start justify-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-muted text-accent"><ScanSearch aria-hidden="true" className="h-6 w-6" /></span>
          <h3 className="mt-5 text-lg font-semibold tracking-tight">Your next chapter is still unwritten.</h3>
          <p className="mt-2 max-w-sm text-sm leading-6 text-text-secondary">Find your first matches. Your searches and company research will appear here.</p>
          <Link href="/find-jobs" className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-accent hover:underline">Find your first matches <ArrowUpRight aria-hidden="true" className="h-4 w-4" /></Link>
        </div>
      ) : (
        <ul className="mt-5 space-y-5">
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-3">
              <ActivityDot type={item.type} />
              <div>
                <p className="text-sm font-medium leading-5 text-text-primary">
                  {item.text}
                </p>
                <p className="mt-0.5 text-xs text-text-muted">{item.time}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
