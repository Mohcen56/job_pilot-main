import { CircleAlert, Clock3 } from "lucide-react";
import type { AIFailure } from "@jobhunt/shared/ai";

type Props = {
  failure: Pick<AIFailure, "error" | "code" | "retryAfterSeconds">;
};

export function AINotice({ failure }: Props) {
  const limited = failure.code === "AI_LIMIT_REACHED" || failure.code === "APP_LIMIT_REACHED";
  const delay = failure.retryAfterSeconds;
  const retryLabel = delay
    ? delay < 60
      ? `${delay} seconds`
      : `${Math.ceil(delay / 60)} minutes`
    : null;

  return (
    <div
      role="alert"
      aria-atomic="true"
      className="flex w-full items-start gap-3 rounded-xl border border-border bg-surface p-4 shadow-card"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-muted text-accent">
        {limited ? (
          <Clock3 aria-hidden="true" className="h-5 w-5" />
        ) : (
          <CircleAlert aria-hidden="true" className="h-5 w-5" />
        )}
      </span>
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-semibold text-text-primary">
          {limited
            ? "AI usage limit reached"
            : "We couldn’t complete that request"}
        </p>
        <p className="text-sm leading-6 text-text-secondary">{failure.error}</p>
        {limited && retryLabel && (
          <p className="text-xs font-medium text-accent">
            Suggested wait before retrying: {retryLabel}.
          </p>
        )}
      </div>
    </div>
  );
}
