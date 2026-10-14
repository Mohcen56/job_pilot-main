"use server";
import { revalidatePath } from "next/cache";
import { createBackendContext } from "@/lib/backend-server";
import { saveAIProvider as saveProvider } from "@jobhunt/api/admin/service";
export async function saveAIProvider(provider: unknown) {
  const result = await saveProvider(provider, await createBackendContext());
  if (result.success) revalidatePath("/admin");
  return result;
}
