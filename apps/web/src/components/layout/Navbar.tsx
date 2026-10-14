"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, UserCircle } from "lucide-react";

import { Logo } from "@/components/layout/Logo";
import { PostHogLogoutLink } from "@/components/analytics/PostHogLogoutLink";

const navigationItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/find-jobs", label: "Find Jobs" },
  { href: "/profile", label: "Profile" },
];

type Props = {
  isAuthenticated?: boolean;
  isAdmin?: boolean;
};

export function Navbar({ isAuthenticated = false, isAdmin = false }: Props) {
  const pathname = usePathname();

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Logo />

        <nav aria-label="Main navigation" className="site-navigation">
          {navigationItems.map((item) => {
            const isActive =
              item.href === "/find-jobs"
                ? pathname.startsWith("/find-jobs")
                : pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={[
                  "text-sm font-medium transition-colors",
                  isActive
                    ? "text-accent"
                    : "text-text-dark hover:text-text-primary",
                ].join(" ")}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {isAuthenticated ? (
          <div className="flex items-center gap-3 sm:gap-6">
            {isAdmin && (
              <Link
                href="/admin"
                aria-current={pathname === "/admin" ? "page" : undefined}
                className="text-sm font-medium text-accent hover:underline"
              >
                Admin
              </Link>
            )}
            <UserCircle className="hidden h-6 w-6 text-info-muted sm:block" />
            <PostHogLogoutLink className="inline-flex items-center gap-2 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary">
              <LogOut className="h-4 w-4" />
              <span>Sign out</span>
            </PostHogLogoutLink>
          </div>
        ) : (
          <Link href="/register" className="landing-button-primary !min-h-10 !px-4 !py-2">
            Get started
          </Link>
        )}
      </div>
    </header>
  );
}
