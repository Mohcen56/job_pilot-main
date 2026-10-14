import type { NormalizedJob, JobProviderName, DiscoveryMethod } from "@jobhunt/shared/types";
import type { SearchTarget } from '../legacy-discovery';
export type CareerSource = { careerUrl: string; provider: JobProviderName; companyIdentifier: string; discoveryMethod: DiscoveryMethod; discoveryUrl?: string };
export type ProviderSearchInput = { source: CareerSource; signal: AbortSignal; titles: string[] };
export interface JobProvider {
  readonly name: JobProviderName;
  canHandle(url: string): boolean;
  fetchJobs(input: ProviderSearchInput): Promise<NormalizedJob[]>;
}
export interface SearchJobProvider {
  readonly name: JobProviderName;
  isConfigured(): boolean;
  search(target: SearchTarget, signal: AbortSignal): Promise<NormalizedJob[]>;
}
export interface CompanyDiscoveryProvider {
  isConfigured(): boolean;
  discover(query: string, signal: AbortSignal): Promise<CareerSource[]>;
}
