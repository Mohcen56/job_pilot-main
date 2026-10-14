import { redirect } from "next/navigation";

import { createBackendContext } from "@/lib/backend-server";

type ProfileCompletionRow = {
  is_complete: boolean | null;
};

export async function getCurrentUser() {
  const backend = await createBackendContext();
  return backend.user;
}

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function getPostLoginRedirectPath(userId: string): Promise<string> {
  const backend = await createBackendContext();
  const { data, error } = await backend.database
    .from("profiles")
    .select("is_complete")
    .eq("id", userId)
    .maybeSingle<ProfileCompletionRow>();

  if (error || !data?.is_complete) {
    return "/profile";
  }

  return "/dashboard";
}
