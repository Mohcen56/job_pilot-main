import { z } from "zod";
import { JOB_BOARDS } from "@jobhunt/shared/types";
const text = z.string().max(2000);
const tags = z.array(z.string().max(200)).max(100);
export const profileFormSchema = z.object({
  fullName: text, phone: text, location: text, linkedinUrl: text, portfolioUrl: text,
  workAuth: text, currentTitle: text, experienceLevel: text,
  yearsExperience: z.string().regex(/^$|^\d{1,2}$/),
  skills: tags, industries: tags,
  workEntries: z.array(z.object({ company: text, title: text, start_date: text, end_date: text, is_current: z.boolean(), responsibilities: z.string().max(10000) })).max(20),
  degree: text, fieldOfStudy: text, institution: text, graduationYear: text,
  jobTitlesSeeking: tags, remotePreference: text, salaryExpectation: text,
  preferredLocations: tags, coverLetterTone: text,
  jobBoards: z.array(z.enum(JOB_BOARDS)).min(1).max(6).default(["direct", "adzuna"]),
  careerUrls: z.array(z.string().url().max(2000).refine(v=>/^https?:\/\//i.test(v))).max(20).optional(),
  freshnessDays: z.union([z.literal(1),z.literal(3),z.literal(7),z.literal(14),z.literal(30),z.null()]).optional(),
});
