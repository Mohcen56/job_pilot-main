import { providerDiagnostic, providerFailureHint } from '../lib/provider-diagnostics';
import type { BackendContext } from '../context';
import type { NormalizedJob } from '@jobhunt/shared/types';
import { buildSearchPlan,countryForLocation,isCountryLocation,type SearchProfile,type SearchTarget } from './legacy-discovery';
import { GreenhouseProvider } from './providers/greenhouse';
import { LeverProvider } from './providers/lever';
import { AshbyProvider } from './providers/ashby';
import { SmartRecruitersProvider } from './providers/smartrecruiters';
import { WorkableProvider } from './providers/workable';
import { GenericCareerPageProvider } from './providers/company';
import { BraveDiscoveryProvider,discoveryQueries } from './providers/brave';
import { AdzunaProvider,JSearchProvider } from './providers/fallback';
import { JoobleProvider } from './providers/jooble';
import { detectProvider } from './providers/detector';
import { parallelMap } from './providers/common';
import { CareerSourceCache } from './source-cache';
import { deduplicateJobs,geographicEligibility,matchesRole,seniority } from './normalization';
import type { CareerSource,JobProvider } from './providers/types';
export { parseSearchRequest,buildSearchPlan,countryForLocation,SearchInputError,JobProviderError,searchTarget } from './legacy-discovery';
export type { DiscoveryJob,SearchProfile,SearchTarget } from './legacy-discovery';

export function ensureProvidersConfigured(targets:SearchTarget[]):string[] {
  const warnings:string[]=[];
  if(targets.some(t=>t.board==='adzuna') && !new AdzunaProvider().isConfigured()) warnings.push('Adzuna is disabled until ADZUNA_APP_ID and ADZUNA_APP_KEY are configured.');
  if(targets.some(t=>['linkedin','indeed','kariyer'].includes(t.board)) && !new JSearchProvider().isConfigured()) warnings.push('JSearch is disabled until OPENWEBNINJA_API_KEY is configured.');
  for (const country of new Set(targets.filter(t=>t.board==='jooble').map(t=>t.country))) if (!new JoobleProvider().isConfigured(country)) warnings.push(`Jooble has no regional connection for ${country.toUpperCase()}; configure JOOBLE_REGIONS. Other sources continued.`);
  return warnings;
}
export type DiscoveryOptions={context?:BackendContext;plan?:ReturnType<typeof buildSearchPlan>;profile?:SearchProfile & {skills?:string[];years_experience?:number|null};freshnessDays?:number|null};
export function filterCollectedJobs(jobs:NormalizedJob[],options:DiscoveryOptions):NormalizedJob[] {
  const profile=options.profile;const plan=options.plan;if(!plan)return deduplicateJobs(jobs);
  const country=plan.eligibilityCountry ?? countryForLocation(profile?.location??'','');
  const remote=plan.locations.some(l=>/^remote$/i.test(l));const local=plan.locations.filter(l=>l && !/^remote$/i.test(l));
  return deduplicateJobs(jobs).filter(job=>{
    Object.assign(job,seniority(job.title,job.description,profile?.years_experience??null));
    job.eligibility=geographicEligibility(job,country);
    if(!matchesRole(job,plan.titles))return false;
    if(options.freshnessDays && (!job.publishedAt || Date.now()-new Date(job.publishedAt).getTime()>options.freshnessDays*86400000))return false;
    const localMatch=!local.length && !remote || local.some(l=>{
      const location=job.location.toLocaleLowerCase('en');
      const requested = l.split(',').map(part=>part.trim());
      const cityMatch = requested.length>1 && location.includes(requested[0].toLocaleLowerCase('en')) && countryForLocation(job.location,'')===countryForLocation(l,'');
      return cityMatch || location.includes(l.toLocaleLowerCase('en')) || (isCountryLocation(l) && countryForLocation(job.location,'')===countryForLocation(l,''));
    });
    if(job.workplaceType==='remote')return job.eligibility.status!=='ineligible' && (remote || localMatch);
    return localMatch;
  });
}
export async function discoverJobs(targets:SearchTarget[],options:DiscoveryOptions={}) {
  const warnings=ensureProvidersConfigured(targets);const collected:NormalizedJob[]=[];
  const signal=AbortSignal.timeout(45000);const plan=options.plan;
  const adzuna=new AdzunaProvider();const jsearch=new JSearchProvider();const jooble=new JoobleProvider();
  const legacyTargets=targets.filter(t=>t.board==='adzuna'?adzuna.isConfigured():t.board==='jooble'?jooble.isConfigured(t.country):['linkedin','indeed','kariyer'].includes(t.board)&&jsearch.isConfigured()).slice(0,18);
  if(targets.length>18)warnings.push('Provider searches are bounded; this run checks up to 18 fallback targets.');
  async function fallbacks() {
    const results=await parallelMap(legacyTargets,3,async target=>target.board==='adzuna'?adzuna.search(target,signal):target.board==='jooble'?jooble.search(target,signal):jsearch.search(target,signal));
    results.forEach((r,i)=>{if(r.status==='fulfilled')collected.push(...r.value);else {warnings.push(`${legacyTargets[i].board}: source unavailable; other sources continued.`);console.warn('[discovery] Fallback failed', {provider:legacyTargets[i].board,country:legacyTargets[i].country,...providerDiagnostic(r.reason)});}});
  }
  async function directSources() {
    if(!plan?.boards.includes('direct'))return;
    const cache=options.context?new CareerSourceCache(options.context):null;
    let known:CareerSource[]=[];
    try {known=await cache?.load()??[];}catch {warnings.push('Career-source cache unavailable; supplied and newly discovered sources will still be searched.');}
    const seeds=(options.profile?.career_urls??[]).flatMap(url=>{const source=detectProvider(url);return source?[source]:[];});
    const brave=new BraveDiscoveryProvider();const discovered:CareerSource[]=[];
    const query=JSON.stringify({titles:plan.titles.map(t=>t.toLowerCase()).sort(),locations:plan.locations.map(l=>l.toLowerCase()).sort()});
    const reuseKnown=known.some(source=>cache?.read(source,query)!==null);
    if(brave.isConfigured() && !reuseKnown) {
      const results=await parallelMap(discoveryQueries(plan.titles,plan.locations,options.profile?.skills??[]),2,q=>brave.discover(q,signal));
      results.forEach(r=>{if(r.status==='fulfilled')discovered.push(...r.value);else {warnings.push('Brave Search unavailable for a discovery query; known company sources continued.');console.warn('[discovery] Brave discovery failed', providerDiagnostic(r.reason));}});
    } else if(!brave.isConfigured()) warnings.push('New company discovery needs SEARCH_API_KEY (Brave). Saved career URLs and cached company sources still work without it.');
    const providers:JobProvider[]=[new GreenhouseProvider(),new LeverProvider(),new AshbyProvider(),new SmartRecruitersProvider(),new WorkableProvider()];
    const visited=new Set<string>();
    const all=[...seeds,...known.slice(0,Math.max(0,8-seeds.length)),...discovered,...known];const unique=[...new Map(all.map(s=>[s.careerUrl,s])).values()];
    if(unique.length>12)warnings.push('This run checks up to 12 company sources; cached sources rotate across searches.');
    if(!unique.length)warnings.push('No company sources yet. Add company career URLs in your profile or configure Brave discovery.');
    const sources=unique.slice(0,12);
    async function fetchSource(source:CareerSource) {
      if(visited.has(source.careerUrl)||signal.aborted)return;visited.add(source.careerUrl);
      await cache?.remember(source);
      await cache?.touch(source);
      const cached=cache?.read(source,query);if(cached) {collected.push(...cached);return;}
      const generic=new GenericCareerPageProvider();const provider=providers.find(p=>p.name===source.provider)??generic;
      const jobs=await provider.fetchJobs({source,signal,titles:plan!.titles});collected.push(...jobs);
      await cache?.save(source,jobs,query);
      for(const url of generic.discoveredSources.slice(0,2)) {if(visited.size>=14)break;const ats=detectProvider(url);if(ats && ats.provider!=='company') {
        try {await fetchSource({...ats,discoveryMethod:source.discoveryMethod,discoveryUrl:source.discoveryUrl??source.careerUrl});}catch {warnings.push(`${ats.provider}: linked ATS unavailable; other sources continued.`);}
      }}
    }
    const results=await parallelMap(sources,3,fetchSource);
    results.forEach((r,i)=>{if(r.status==='rejected') {warnings.push(`${sources[i].provider}: company source unavailable; other sources continued. ${providerFailureHint(r.reason)}`);console.warn('[discovery] Company source failed', {provider:sources[i].provider,board:sources[i].companyIdentifier,...providerDiagnostic(r.reason)});}});
  }
  const branches=await Promise.allSettled([fallbacks(),directSources()]);
  branches.forEach((result,index)=>{if(result.status==='rejected') {warnings.push(`${index?'Company':'Fallback'} discovery could not finish; other sources continued.`);console.warn('[discovery] Discovery branch unavailable',index);}});
  const jobs=filterCollectedJobs(collected,options);
  const unknown=jobs.filter(j=>j.workplaceType==='remote' && j.eligibility.status==='unknown').length;
  if(unknown)warnings.push(`${unknown} remote listing(s) have unknown eligibility. Check their geographic restrictions before applying.`);
  if(jobs.length>40)warnings.push('Showing up to 40 unique jobs from this run.');
  return {jobs:jobs.slice(0,40),warnings:[...new Set(warnings)]};
}
