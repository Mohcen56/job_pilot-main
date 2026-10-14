export type MissingField =
  | "FULL NAME"
  | "PHONE"
  | "LOCATION"
  | "JOB TITLE"
  | "EXPERIENCE LEVEL"
  | "YEARS EXP"
  | "SKILLS"
  | "WORK EXPERIENCE"
  | "EDUCATION";

export const JOB_BOARDS = ["direct", "adzuna", "linkedin", "indeed", "kariyer", "jooble"] as const;
export type JobBoard = (typeof JOB_BOARDS)[number];
export const JOB_BOARD_LABELS: Record<JobBoard, string> = { direct: "Company careers / ATS", adzuna: "Adzuna", linkedin: "LinkedIn", indeed: "Indeed", kariyer: "Kariyer.net", jooble: "Jooble" };
export const JOB_PROVIDERS = ["greenhouse", "lever", "ashby", "smartrecruiters", "workable", "company", "adzuna", "jsearch", "jooble"] as const;
export type JobProviderName = (typeof JOB_PROVIDERS)[number];
export type DiscoveryMethod = "ats_direct" | "company_career_page" | "search_discovery" | "jsearch" | "adzuna" | "jooble";
export type WorkplaceType = "remote" | "hybrid" | "onsite" | "unknown";
export type GeographicEligibility = { scope: "worldwide" | "countries" | "europe" | "eu" | "emea" | "unknown"; countries: string[]; status: "eligible" | "ineligible" | "unknown"; evidence: string };
export type NormalizedJob = {
  externalId: string; title: string; company: string; description: string; location: string;
  country?: string; city?: string; workplaceType: WorkplaceType; employmentType?: string;
  experienceLevel: string; seniorityMatch: "strong" | "stretch" | "poor" | "unknown";
  salary?: string; salaryMin?: number; salaryMax?: number; currency?: string;
  publishedAt: string | null; source: JobProviderName; sourceUrl: string; applyUrl: string;
  discoveredAt: string; discoveryMethod: DiscoveryMethod; discoveryUrl?: string;
  sourceBoard?: JobBoard;
  eligibility: GeographicEligibility;
};

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  current_title: string | null;
  experience_level: string | null;
  years_experience: number | null;
  skills: string[];
  industries: string[];
  work_experience: WorkExperience[] | null;
  education: Education | null;
  job_titles_seeking: string[];
  remote_preference: string | null;
  preferred_locations: string[];
  job_boards: JobBoard[];
  career_urls?: string[];
  freshness_days?: number | null;
  salary_expectation: string | null;
  cover_letter_tone: string | null;
  linkedin_url: string | null;
  portfolio_url: string | null;
  work_authorization: string | null;
  resume_pdf_url: string | null;
  linkedin_context_id: string | null;
  linkedin_connected: boolean;
  is_complete: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkExperience {
  company: string;
  title: string;
  start_date: string;
  end_date: string | null;
  is_current: boolean;
  responsibilities: string;
}

export interface Education {
  degree: string | null;
  field: string | null;
  institution: string | null;
  graduation_year: string | null;
}

export interface AgentRun {
  id: string;
  user_id: string;
  status: "running" | "completed" | "failed";
  job_title_searched: string | null;
  location_searched: string | null;
  jobs_found: number;
  started_at: string;
  completed_at: string | null;
}

export interface Job {
  id: string;
  run_id: string | null;
  user_id: string;
  source: "search" | "url";
  source_board?: JobBoard | null;
  source_provider?: JobProviderName | null;
  external_id?: string | null;
  canonical_apply_url?: string | null;
  published_at?: string | null;
  workplace_type?: WorkplaceType;
  geographic_eligibility?: GeographicEligibility | null;
  experience_level?: string | null;
  seniority_match?: NormalizedJob["seniorityMatch"];
  discovery_method?: DiscoveryMethod | null;
  discovery_url?: string | null;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_currency?: string | null;
  match_status?: "pending" | "scored";
  match_profile_hash?: string | null;
  source_url: string | null;
  external_apply_url: string | null;
  title: string | null;
  company: string | null;
  location: string | null;
  salary: string | null;
  job_type: string | null;
  about_role: string | null;
  responsibilities: string[];
  requirements: string[];
  nice_to_have: string[];
  benefits: string[];
  about_company: string | null;
  match_score: number | null;
  match_reason: string | null;
  matched_skills: string[];
  missing_skills: string[];
  cover_letter: string | null;
  tailored_resume_url: string | null;
  tailored_match_score: number | null;
  is_tailored: boolean;
  company_research: CompanyResearchDossier | null;
  found_at: string;
}

export interface CompanyResearchDossier {
  companyOverview: string;
  techStack: string[];
  culture: string[];
  whyThisRole: string;
  yourEdge: string[];
  gapsToAddress: string[];
  smartQuestions: string[];
  interviewPrep: string[];
  sources: string[];
}

export interface AgentLog {
  id: string;
  run_id: string | null;
  user_id: string;
  message: string;
  level: "info" | "success" | "warning" | "error";
  job_id: string | null;
  created_at: string;
}
