import { z } from "zod";

const adzunaJobSchema = z.object({
  id: z.string(), title: z.string(), company: z.object({ display_name: z.string() }),
  location: z.object({ display_name: z.string() }), description: z.string(),
  redirect_url: z.string().url().refine((value) => /^https?:\/\//i.test(value)),
  salary_min: z.number().optional(), salary_max: z.number().optional(),
  salary_is_predicted: z.enum(["0", "1"]), contract_type: z.string().optional(),
  created: z.string(), category: z.object({ tag: z.string(), label: z.string() }),
});
export type AdzunaJob = {
  id: string;
  title: string;
  company: { display_name: string };
  location: { display_name: string };
  description: string;
  redirect_url: string;
  salary_min?: number;
  salary_max?: number;
  salary_is_predicted: "0" | "1";
  contract_type?: string;
  created: string;
  category: { tag: string; label: string };
};

export async function searchJobs(
  jobTitle: string,
  location: string,
  country: string = "us",
  signal?: AbortSignal,
): Promise<AdzunaJob[]> {
  const params = new URLSearchParams({
    app_id: process.env.ADZUNA_APP_ID!,
    app_key: process.env.ADZUNA_APP_KEY!,
    what: jobTitle,
    results_per_page: "10",
    "content-type": "application/json",
  });

  if (location) {
    params.set("where", location);
  }

  const response = await fetch(
    `https://api.adzuna.com/v1/api/jobs/${country}/search/1?${params}`,
    { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000) },
  );

  if (!response.ok) {
    throw new Error(`Adzuna API error: ${response.status}`);
  }

  const data = z.object({ results: z.array(z.unknown()) }).parse(await response.json());
  return data.results.flatMap((value) => {
    const parsed = adzunaJobSchema.safeParse(value);
    return parsed.success ? [parsed.data] : [];
  });
}
