import "server-only";

import { createBackendContext } from "@/lib/backend-server";

export async function isAdmin(userId: string): Promise<boolean> {
  try {
    const backend = await createBackendContext();
    const { data, error } = await backend.database
      .from("app_admins")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle<{ user_id: string }>();
    if (error) return false;
    return data?.user_id === userId;
  } catch {
    return false;
  }
}
