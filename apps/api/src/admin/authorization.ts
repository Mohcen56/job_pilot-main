import type { BackendContext } from "../context";
export async function isAdminUser(context: BackendContext) {
  if (!context.user) return false;
  const { data, error } = await context.database.from("app_admins").select("user_id").maybeSingle<{ user_id: string }>();
  return !error && data?.user_id === context.user.id;
}
