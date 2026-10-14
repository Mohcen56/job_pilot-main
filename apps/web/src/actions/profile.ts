"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createBackendContext } from "@/lib/backend-server";
import * as profileService from "@jobhunt/api/profile/service";
export type { ExtractedProfile } from "@jobhunt/api/profile/service";
export async function saveProfile(data: profileService.ProfileFormData) {
  await requireUser();
  const result = await profileService.saveProfile(data, await createBackendContext());
  if (result.success) revalidatePath("/profile");
  return result;
}
export async function uploadResume(formData: FormData) {
  await requireUser();
  const result = await profileService.uploadResume(formData, await createBackendContext());
  if (result.success) revalidatePath("/profile");
  return result;
}
export async function extractProfile() {
  await requireUser();
  return profileService.extractProfile(await createBackendContext());
}
