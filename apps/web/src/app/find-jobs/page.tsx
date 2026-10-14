import { isAdmin } from "@/lib/admin";
export const dynamic = "force-dynamic";

import { PostHogIdentify } from "@/components/analytics/PostHogIdentify";
import { FindJobsClient } from "@/components/find-jobs/FindJobsClient";
import { Navbar } from "@/components/layout/Navbar";
import { requireUser } from "@/lib/auth";
import { createBackendContext } from "@/lib/backend-server";
import type { Job } from "@jobhunt/shared/types";

export default async function FindJobsPage() {
  const user = await requireUser();
  const backend = await createBackendContext();

  const { data: jobs, count } = await backend.database
    .from("jobs")
    .select("*", { count: "exact" })
    .eq("user_id", user.id)
    .order("match_score", { ascending: false, nullsFirst: false })
    .range(0, 19)
    .rows<Job>();

  const initialJobs = jobs ?? [];
  const initialTotalCount = count ?? 0;

  return (
    <>
      <PostHogIdentify userId={user.id} />
      <Navbar isAuthenticated isAdmin={await isAdmin(user.id)} />
      <main id="main-content" tabIndex={-1} className="mx-auto flex w-full min-w-0 min-h-[calc(100vh-4rem)] max-w-[1440px] flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="app-page-heading"><div><h1>Find your next opportunity.</h1><p>Discover roles, compare your matches, and build a shortlist worth your time.</p></div></div>

        <FindJobsClient initialJobs={initialJobs} initialTotalCount={initialTotalCount} />
      </main>
    </>
  );
}
