import Link from "next/link";
import { BriefcaseBusiness } from "lucide-react";

type Props = {
  href?: string;
};

export function Logo({ href = "/" }: Props) {
  return (
    <Link
      href={href}
      aria-label="JobHunt EZ home"
      className="inline-flex shrink-0 items-center gap-2"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
        <BriefcaseBusiness aria-hidden="true" className="h-5 w-5" />
      </span>
      <span className="text-base font-bold tracking-tight text-text-darkest sm:text-[19px]">
        JobHunt EZ
      </span>
    </Link>
  );
}
