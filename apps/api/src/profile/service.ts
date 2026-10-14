import type { BackendContext } from "../context";
import { UsageLimitError, withUsageLimit } from "../usage";
import { profileFormSchema } from "./validation";

import { completeAI } from "../ai/completions";
import { AIServiceError } from "../lib/ai-errors";
import type { AIFailure } from "@jobhunt/shared/ai";
import { extractedProfileSchema } from "../lib/ai-schemas";
import { readResumeText, ResumePDFError } from "../resumes/pdf-text";

import { trackPostHogEvent } from "../lib/posthog-server";
import { calculateCompletion } from "@jobhunt/shared/profile";
import type { Education, WorkExperience, JobBoard } from "@jobhunt/shared/types";

type WorkExperienceEntry = {
  company: string;
  title: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  responsibilities: string;
};

export type ProfileFormData = {
  fullName: string;
  phone: string;
  location: string;
  linkedinUrl: string;
  portfolioUrl: string;
  workAuth: string;
  currentTitle: string;
  experienceLevel: string;
  yearsExperience: string;
  skills: string[];
  industries: string[];
  workEntries: WorkExperienceEntry[];
  degree: string;
  fieldOfStudy: string;
  institution: string;
  graduationYear: string;
  jobTitlesSeeking: string[];
  remotePreference: string;
  salaryExpectation: string;
  preferredLocations: string[];
  jobBoards?: JobBoard[];
  careerUrls?: string[];
  freshnessDays?: number | null;
  coverLetterTone: string;
};

export async function saveProfile(
  data: ProfileFormData,
  context: BackendContext,
): Promise<{ success: boolean; error?: string }> {
  const user = context.user;
  if (!user) return { success: false, error: "Unauthorized" };

  const validated = profileFormSchema.safeParse(data);
  if (!validated.success) return { success: false, error: "Check your profile fields and try again." };
  data = validated.data;

  try {
    const backend = context;

    const education: Education = {
      degree: data.degree || null,
      field: data.fieldOfStudy || null,
      institution: data.institution || null,
      graduation_year: data.graduationYear || null,
    };

    const parsed = parseInt(data.yearsExperience, 10);
    const yearsExperience =
      data.yearsExperience && !isNaN(parsed) ? parsed : null;

    const workExperience: WorkExperience[] = data.workEntries.map((e) => ({
      company: e.company,
      title: e.title,
      start_date: e.start_date,
      end_date: e.is_current ? null : e.end_date || null,
      is_current: e.is_current,
      responsibilities: e.responsibilities,
    }));

    const { data: existing } = await backend.database
      .from("profiles")
      .select("is_complete")
      .eq("id", user.id)
      .maybeSingle<{ is_complete: boolean }>();

    const { isComplete } = calculateCompletion({
      full_name: data.fullName || null,
      phone: data.phone || null,
      location: data.location || null,
      current_title: data.currentTitle || null,
      experience_level: data.experienceLevel || null,
      years_experience: yearsExperience,
      skills: data.skills,
      work_experience: workExperience,
      education,
    });

    const { data: updated, error } = await backend.database
      .from("profiles")
      .update({
        full_name: data.fullName || null,
        phone: data.phone || null,
        location: data.location || null,
        linkedin_url: data.linkedinUrl || null,
        portfolio_url: data.portfolioUrl || null,
        work_authorization: data.workAuth || null,
        current_title: data.currentTitle || null,
        experience_level: data.experienceLevel || null,
        years_experience: yearsExperience,
        skills: data.skills,
        industries: data.industries,
        work_experience: workExperience,
        education,
        job_titles_seeking: data.jobTitlesSeeking,
        remote_preference: data.remotePreference || null,
        salary_expectation: data.salaryExpectation || null,
        preferred_locations: data.preferredLocations,
        job_boards: data.jobBoards,
        ...(data.careerUrls === undefined ? {} : { career_urls: data.careerUrls }),
        ...(data.freshnessDays === undefined ? {} : { freshness_days: data.freshnessDays }),
        cover_letter_tone: data.coverLetterTone || null,
        is_complete: isComplete,
      })
      .eq("id", user.id)
      .select("id")
      .maybeSingle<{ id: string }>();

    if (error) {
      console.error("[actions/profile] saveProfile", error);
      return { success: false, error: "Failed to save profile" };
    }

    if (!updated) {
      console.error(
        "[actions/profile] saveProfile no row matched for user",
        user.id,
      );
      return {
        success: false,
        error: "Profile not found. Please sign out and sign in again.",
      };
    }

    if (isComplete && !existing?.is_complete) {
      await trackPostHogEvent({
        event: "profile_completed",
        properties: { userId: user.id },
      });
    }
    return { success: true };
  } catch (error) {
    console.error("[actions/profile] saveProfile", error);
    return { success: false, error: "Failed to save profile" };
  }
}

export async function uploadResume(
  formData: FormData,
  context: BackendContext,
): Promise<{ success: boolean; error?: string }> {
  const user = context.user;
  if (!user) return { success: false, error: "Unauthorized" };

  try {
    const backend = context;

    const file = formData.get("resume");
    if (!(file instanceof File)) {
      return { success: false, error: "No file provided" };
    }
    if (file.type !== "application/pdf") {
      return { success: false, error: "File must be a PDF" };
    }
    if (file.size > 2 * 1024 * 1024) {
      return { success: false, error: "File must be under 2MB" };
    }

    const path = `${user.id}/resume.pdf`;

    // Replace the PDF atomically after validating it.

    const { error: uploadError } = await backend.storage
      .from("resumes")
      .upload(path, file);

    if (uploadError) {
      console.error("[actions/profile] uploadResume storage", uploadError);
      return { success: false, error: "Failed to upload resume" };
    }

    // Store the storage path, not a public URL â€” bucket is private.
    // Download happens via /api/resume/download which authenticates server-side.
    const { error: dbError } = await backend.database
      .from("profiles")
      .update({ resume_pdf_url: path })
      .eq("id", user.id);

    if (dbError) {
      console.error("[actions/profile] uploadResume db", dbError);
      return { success: false, error: "Failed to save resume URL" };
    }
    return { success: true };
  } catch (error) {
    console.error("[actions/profile] uploadResume", error);
    return { success: false, error: "Failed to upload resume" };
  }
}

export type ExtractedProfile = {
  full_name: string | null;
  phone: string | null;
  location: string | null;
  current_title: string | null;
  experience_level: string | null;
  years_experience: number | null;
  skills: string[];
  industries: string[];
  work_experience: WorkExperience[];
  education: Education;
  job_titles_seeking: string[];
  linkedin_url: string | null;
  portfolio_url: string | null;
};

export async function extractProfile(context: BackendContext): ReturnType<typeof extractProfileWork> {
  if (!context.user) return { success: false, error: "Unauthorized" };
  try { return await extractProfileWork(context); }
  catch (error) {
    if (error instanceof UsageLimitError) return error.failure();
    return { success: false, error: "The assistant is temporarily unavailable. Please try again later." };
  }
}
async function extractProfileWork(context: BackendContext): Promise<{
  success: boolean;
  data?: ExtractedProfile;
  error?: string;
  code?: AIFailure["code"];
  provider?: AIFailure["provider"];
  retryAfterSeconds?: number;
}> {
  const user = context.user;
  if (!user) return { success: false, error: "Unauthorized" };

  try {
    const backend = context;

    const { data: fileData, error: downloadError } = await backend.storage
      .from("resumes")
      .download(`${user.id}/resume.pdf`);

    if (downloadError || !fileData) {
      return {
        success: false,
        error: "No resume found. Please upload your resume first.",
      };
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const extractedText = await readResumeText(new Uint8Array(arrayBuffer));

    // Reading/validating a local PDF must not consume the paid AI allowance.
    const raw = await withUsageLimit(context, () => completeAI({
      temperature: 0.3,
      max_tokens: 4096,
      messages: [
        {
          role: "system",
          content:
            "You are a resume parser. Extract structured profile data from the resume text and return only valid JSON matching the exact schema provided. Use null for missing fields. Arrays must always be arrays (never null). experience_level must be one of: Junior, Mid-Level, Senior, Lead, Manager, Director, Executive â€” pick the closest match or null.",
        },
        {
          role: "user",
          content: `Extract profile data from this resume and return JSON with this exact shape:
{
  "full_name": string | null,
  "phone": string | null,
  "location": string | null,
  "current_title": string | null,
  "experience_level": "Junior"|"Mid-Level"|"Senior"|"Lead"|"Manager"|"Director"|"Executive"|null,
  "years_experience": number | null,
  "skills": string[],
  "industries": string[],
  "work_experience": [{ "company": string, "title": string, "start_date": string, "end_date": string|null, "is_current": boolean, "responsibilities": string }],
  "education": { "degree": string|null, "field": string|null, "institution": string|null, "graduation_year": string|null },
  "job_titles_seeking": string[],
  "linkedin_url": string|null,
  "portfolio_url": string|null
}

Resume text:
${extractedText.slice(0, 6000)}`,
        },
      ],
    }));

    if (!raw) {
      return { success: false, error: "AI returned an empty response." };
    }

    const extracted = extractedProfileSchema.safeParse(JSON.parse(raw));
    if (!extracted.success) return { success: false, error: "The assistant returned an incomplete profile. Please try again or fill in your profile manually." };

    return { success: true, data: extracted.data };
  } catch (error) {
    if (error instanceof UsageLimitError) return error.failure();
    if (error instanceof AIServiceError) return error.failure;
    if (error instanceof ResumePDFError) return { success: false, error: error.message };
    console.error(
      "[actions/profile] extractProfile",
      "Resume extraction failed",
    );
    return { success: false, error: "Failed to extract profile from resume." };
  }
}
