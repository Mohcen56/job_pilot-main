import { z } from "zod";

export const scoredJobsSchema = z.object({
  results: z.array(
    z.object({
      jobId: z.string(),
      matchScore: z.number().int().min(0).max(100),
      matchReason: z.string().min(1),
      matchedSkills: z.array(z.string()),
      missingSkills: z.array(z.string()),
    }),
  ),
});

const workEntrySchema = z.object({
  company: z.string(),
  title: z.string(),
  start_date: z.string(),
  end_date: z.string().nullable(),
  is_current: z.boolean(),
});

export const generatedResumeSchema = z.object({
  summary: z.string().min(1),
  work_experience: z.array(
    workEntrySchema.extend({ bullets: z.array(z.string()) }),
  ),
});

export const extractedProfileSchema = z.object({
  full_name: z.string().nullable(),
  phone: z.string().nullable(),
  location: z.string().nullable(),
  current_title: z.string().nullable(),
  experience_level: z.string().nullable(),
  years_experience: z.number().min(0).nullable(),
  skills: z.array(z.string()),
  industries: z.array(z.string()),
  work_experience: z.array(
    workEntrySchema.extend({ responsibilities: z.string() }),
  ),
  education: z.object({
    degree: z.string().nullable(),
    field: z.string().nullable(),
    institution: z.string().nullable(),
    graduation_year: z.string().nullable(),
  }),
  job_titles_seeking: z.array(z.string()),
  linkedin_url: z.string().nullable(),
  portfolio_url: z.string().nullable(),
});
