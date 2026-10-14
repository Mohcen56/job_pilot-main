import { isAdmin } from "@/lib/admin";
export const dynamic = "force-dynamic";

import { PostHogIdentify } from "@/components/analytics/PostHogIdentify";
import { Navbar } from "@/components/layout/Navbar";
import { ProfileAttentionBanner } from "@/components/profile/ProfileAttentionBanner";
import { ProfilePageClient } from "@/components/profile/ProfilePageClient";
import { requireUser } from "@/lib/auth";
import { createBackendContext } from "@/lib/backend-server";
import { calculateCompletion } from "@jobhunt/shared/profile";
import type { Profile } from "@jobhunt/shared/types";

export default async function ProfilePage() {
  const user = await requireUser();
  const backend = await createBackendContext();

  const { data: profile } = await backend.database
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  const { completionPercent, missingFields } = calculateCompletion({
    full_name: profile?.full_name ?? null,
    phone: profile?.phone ?? null,
    location: profile?.location ?? null,
    current_title: profile?.current_title ?? null,
    experience_level: profile?.experience_level ?? null,
    years_experience: profile?.years_experience ?? null,
    skills: profile?.skills ?? [],
    work_experience: profile?.work_experience ?? null,
    education: profile?.education ?? null,
  });

  return (
    <>
      <PostHogIdentify userId={user.id} />
      <Navbar isAuthenticated isAdmin={await isAdmin(user.id)} />
      <main id="main-content" tabIndex={-1} className="mx-auto flex w-full min-h-[calc(100vh-4rem)] max-w-[1440px] flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="app-page-heading"><div><h1>Your story starts here.</h1><p>Keep your experience and preferences up to date for more relevant matches.</p></div></div>

        <ProfileAttentionBanner
          completionPercent={completionPercent}
          missingFields={missingFields}
        />
        <ProfilePageClient profile={profile ?? null} />
      </main>
    </>
  );
}
