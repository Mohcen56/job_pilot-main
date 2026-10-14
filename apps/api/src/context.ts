import { ScopedDatabase } from "./database/database";
import { ResumeStorage } from "./storage/storage";
import { cookieValue, resolveSession, SESSION_COOKIE, type User } from "./auth/session";

export type BackendContext = { user: User | null; database: ScopedDatabase; storage: ResumeStorage };
export function contextForUser(user: User | null): BackendContext {
  // No anonymous access to personal data; the zero UUID can never match provisioned users.
  const id = user?.id ?? "00000000-0000-0000-0000-000000000000";
  return { user, database: new ScopedDatabase(id), storage: new ResumeStorage(id) };
}
export async function contextFromRequest(request: Request): Promise<BackendContext> {
  return contextForUser(await resolveSession(cookieValue(request.headers.get("cookie"), SESSION_COOKIE)));
}
