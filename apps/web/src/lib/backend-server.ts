import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { contextForUser } from "@jobhunt/api/context";
import { resolveSession, SESSION_COOKIE } from "@jobhunt/api/auth/session";

// React cache is scoped to one server request, never shared between users.
export const createBackendContext = cache(async () => {
  const cookieStore = await cookies();
  return contextForUser(await resolveSession(cookieStore.get(SESSION_COOKIE)?.value));
});
