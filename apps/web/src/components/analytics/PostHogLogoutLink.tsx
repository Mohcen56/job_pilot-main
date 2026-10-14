"use client";

import type { ReactNode } from "react";

import { resetPostHogUser } from "@/lib/posthog-client";

type Props = {
  children: ReactNode;
  className: string;
};

export function PostHogLogoutLink({ children, className }: Props) {
  return (
    <form action="/api/auth/logout" method="post" onSubmit={() => resetPostHogUser()}>
      <button type="submit" className={className}>{children}</button>
    </form>
  );
}
